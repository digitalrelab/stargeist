export class ProfileError extends Error {
  constructor(
    readonly code:
      | "unsafe-path"
      | "unmanaged-profile"
      | "invalid-owner"
      | "profile-busy"
      | "unsupported-runtime"
      | "coordination-unavailable"
      | "workspace-registry-unavailable"
      | "reset-changed"
      | "invalid-environment",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProfileError";
  }
}
