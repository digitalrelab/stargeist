export class IdentityUnavailable extends Error {
  readonly code = "IdentityUnavailable";
}

export class ObservationExpired extends Error {
  readonly code = "ObservationExpired";
}
