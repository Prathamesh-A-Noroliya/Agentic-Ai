import type { AgentId, AgentMessage } from "../types";

export type AgentTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timed_out";

export interface AgentTask {
  task_id: string;
  incident_id: string;
  agent: AgentId;
  request_message_id: string;
  status: AgentTaskStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  deadline_at: string;
  response_message_id?: string;
  error?: string;
}

const TERMINAL_STATUSES: AgentTaskStatus[] = [
  "completed",
  "failed",
  "timed_out",
];

export class AgentTaskManager {
  private readonly tasks = new Map<string, AgentTask>();
  private readonly requestIndex = new Map<string, string>();

  createTask(
    request: AgentMessage,
    timeoutMs = 30_000
  ): AgentTask {
    if (request.message_type !== "request") {
      throw new Error("A task must be created from a request message.");
    }

    if (request.sender !== "coordinator") {
      throw new Error("Only the coordinator can create agent tasks.");
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("Task timeout must be a positive finite number.");
    }

    if (this.requestIndex.has(request.message_id)) {
      throw new Error("A task already exists for this request.");
    }

    const now = Date.now();
    const task: AgentTask = {
      task_id: crypto.randomUUID(),
      incident_id: request.incident_id,
      agent: request.recipient,
      request_message_id: request.message_id,
      status: "pending",
      created_at: new Date(now).toISOString(),
      deadline_at: new Date(now + timeoutMs).toISOString(),
    };

    this.tasks.set(task.task_id, task);
    this.requestIndex.set(request.message_id, task.task_id);

    return structuredClone(task);
  }

  markRunning(taskId: string): AgentTask {
    const task = this.requireTask(taskId);
    this.ensureActive(task);

    if (task.status !== "pending") {
      throw new Error("Only pending tasks can be started.");
    }

    if (Date.now() >= Date.parse(task.deadline_at)) {
      task.status = "timed_out";
      throw new Error("Task deadline has expired.");
    }

    task.status = "running";
    task.started_at = new Date().toISOString();

    return structuredClone(task);
  }

  completeFromResponse(response: AgentMessage): AgentTask {
    if (response.message_type !== "response") {
      throw new Error("Only response messages can complete a task.");
    }

    if (!response.correlation_id) {
      throw new Error("Response is missing its correlation ID.");
    }

    const taskId = this.requestIndex.get(response.correlation_id);

    if (!taskId) {
      throw new Error("Response does not match a known task.");
    }

    const task = this.requireTask(taskId);

    if (response.incident_id !== task.incident_id) {
      throw new Error("Response incident does not match the task.");
    }

    if (response.sender !== task.agent) {
      throw new Error("Response sender does not match the assigned agent.");
    }

    if (response.recipient !== "coordinator") {
      throw new Error("Response recipient must be the coordinator.");
    }

    this.ensureActive(task);

    if (Date.now() >= Date.parse(task.deadline_at)) {
      task.status = "timed_out";
      throw new Error("Task response arrived after its deadline.");
    }

    if (task.status !== "running") {
      throw new Error("Task must be running before it can complete.");
    }

    task.status = "completed";
    task.completed_at = new Date().toISOString();
    task.response_message_id = response.message_id;

    return structuredClone(task);
  }

  failTask(taskId: string, reason: string): AgentTask {
    const task = this.requireTask(taskId);
    this.ensureActive(task);

    if (typeof reason !== "string" || !reason.trim()) {
      throw new Error("A failure reason is required.");
    }

    task.status = "failed";
    task.error = reason.trim();
    task.completed_at = new Date().toISOString();

    return structuredClone(task);
  }

  expireTasks(now = Date.now()): AgentTask[] {
    if (!Number.isFinite(now)) {
      throw new Error("Expiration time must be a finite timestamp.");
    }

    const expired: AgentTask[] = [];

    for (const task of this.tasks.values()) {
      if (
        !TERMINAL_STATUSES.includes(task.status) &&
        now >= Date.parse(task.deadline_at)
      ) {
        task.status = "timed_out";
        task.completed_at = new Date(now).toISOString();
        expired.push(structuredClone(task));
      }
    }

    return expired;
  }

  getTask(taskId: string): AgentTask | undefined {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }

  getTaskForRequest(requestMessageId: string): AgentTask | undefined {
    const taskId = this.requestIndex.get(requestMessageId);
    return taskId ? this.getTask(taskId) : undefined;
  }

  getTasks(): AgentTask[] {
    return structuredClone(Array.from(this.tasks.values()));
  }

  private requireTask(taskId: string): AgentTask {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Unknown agent task: ${taskId}`);
    }

    return task;
  }

  private ensureActive(task: AgentTask): void {
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new Error(`Task is already ${task.status}.`);
    }
  }
}
