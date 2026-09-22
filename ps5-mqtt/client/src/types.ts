export interface Stats {
  mqttInfo: {
    clientId: string
  }
}

export interface DiscoveryResponse {
  devices: IDevice[]
}

export interface IDeviceAddress {
  address: string
  family: string
  port: number
}

export interface IPsnAccount {
  connected: boolean
  accountName?: string
  refreshTokenExpiresAt?: number
  expiresInMs?: number | null
}

export interface IActivity {
  titleId?: string
  titleName?: string
}

export interface IDevice {
  id: string
  name: string
  status: "AWAKE" | "STANDBY"
  registered?: boolean
  type?: string
  systemVersion?: string
  address?: IDeviceAddress
  activity?: IActivity
}

export interface ILogger {
  log(message: unknown): void
  error(message: unknown): void
}

export interface IMessage {
  type: "error" | "info"
  value: string
}
