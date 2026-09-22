import type {DiscoveryResponse, IDevice, ILogger, IPsnAccount} from "./types"

export default class Api {
  constructor(private readonly logger: ILogger) {}

  async connectToDevice(
    device: IDevice,
    pin: string,
    url: string,
  ): Promise<string | undefined> {
    try {
      const res = await fetch("api/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device,
          pin,
          url,
        }),
      })
      if (res.status >= 400 && res.status < 600) {
        this.logger.error(await res.text())
      } else {
        return await res.text()
      }
    } catch (e) {
      this.logger.error(e)
    }
  }

  async acquireAuthenticationLink(
    device: IDevice,
  ): Promise<string | undefined> {
    try {
      const res = await fetch("api/acquire-authentication-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device,
        }),
      })
      if (res.status >= 400 && res.status < 600) {
        this.logger.error(await res.text())
      } else {
        return await res.text()
      }
    } catch (e) {
      this.logger.error(e)
    }
  }


  async getPsnAccount(): Promise<IPsnAccount | undefined> {
    try {
      const res = await fetch("api/psn-account", { method: "GET" })
      return (await res.json()) as IPsnAccount
    } catch (e) {
      this.logger.error(e)
      return undefined
    }
  }

  // Resolves the server's message on rejection so the form can show why the
  // token was refused instead of just failing.
  async connectPsnAccount(npsso: string): Promise<string | undefined> {
    const res = await fetch("api/psn-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ npsso }),
    })
    if (res.ok) {
      return undefined
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return body.error ?? `HTTP ${res.status}`
  }

  async getDevices(): Promise<IDevice[] | undefined> {
    try {
      const res = await fetch("api/discover", {
        method: "GET",
      })
      return ((await res.json()) as DiscoveryResponse)?.devices
    } catch (e) {
      this.logger.error(e)
      return undefined
    }
  }
}
