import type {
  DiscoveryResponse,
  IDevice,
  ILogger,
  IPsnAccount,
  Stats,
} from "./types"

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

  async getStats(): Promise<Stats | undefined> {
    try {
      const res = await fetch("api/stats", {
        method: "GET",
      })
      return await res.json()
    } catch (e) {
      this.logger.error(e)
      return undefined
    }
  }

  async getPsnAccount(): Promise<IPsnAccount | undefined> {
    try {
      const res = await fetch("api/psn-account", { method: "GET" })
      if (!res.ok) {
        throw new Error(`GET api/psn-account answered HTTP ${res.status}`)
      }
      return (await res.json()) as IPsnAccount
    } catch (e) {
      this.logger.error(e)
      return undefined
    }
  }

  async connectPsnAccount(npsso: string): Promise<string | undefined> {
    let res: Response
    try {
      res = await fetch("api/psn-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npsso }),
      })
    } catch (e) {
      this.logger.error(e)
      return "Could not reach the add-on. Try again in a moment."
    }
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
