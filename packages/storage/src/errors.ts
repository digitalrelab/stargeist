export class StorageError extends Error {
  constructor(
    readonly code: "unsafe-path" | "workspace-registry-unavailable",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StorageError";
  }
}
