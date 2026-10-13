import bodyParser from "body-parser"
import createDebugger from "debug"
import express, { Express } from "express"
import { existsSync, readFileSync } from "fs"
import path from "path"

import { IDiscoveredDevice } from "playactor/dist/discovery/model"
import { IInputOutput } from "playactor/dist/cli/io"
import { CredentialManager } from "playactor/dist/credentials"
import { DiskCredentialsStorage } from "playactor/dist/credentials/disk-storage"
import { OauthCredentialRequester } from "playactor/dist/credentials/oauth/requester"
import { WriteOnlyStorage } from "playactor/dist/credentials/write-only-storage"

import { pollAgeMs } from "./health"
import { discoverDevices } from "./playactor/discovery"
import type { State } from "./redux/types"
import { Settings } from "./services"
import { createErrorLogger } from "./util/error-logger"

const debug = createDebugger("@ha:ps5:webserver")
const debugPa = createDebugger("@ha:ps5:webserver:playactor")
const logError = createErrorLogger()

let app: Express | undefined = undefined

export function setupWebserver(
  port: number | string,
  {
    allowPs4Devices,
    credentialStoragePath,
    deviceDiscoveryBroadcastAddress,
  }: Settings,
  getState: () => State | undefined,
): Express {
  if (app !== undefined) {
    throw Error("web server is already running")
  }

  app = express()

  // host client files
  app.use(
    "/",
    express.static(path.join(__dirname, "..", "..", "client", "dist")),
  )
  app.use(bodyParser.json())

  const maxPollAgeMs = Number(process.env.MAX_POLL_AGE_MS ?? 120000)
  app.get("/api/health", (req, res) => {
    const age = pollAgeMs()
    const ok = age !== undefined && age <= maxPollAgeMs
    res
      .status(ok ? 200 : 503)
      .send({ ok, pollAgeMs: age ?? null, maxPollAgeMs })
  })

  app.get("/api/discover", async (req, res) => {
    try {
      const devices: IDiscoveredDevice[] = await discoverDevices({
        allowPs4Devices,
        deviceDiscoveryBroadcastAddress,
        timeoutMillis: 5000,
      })

      let pairedIds = new Set<string>()
      try {
        if (existsSync(credentialStoragePath)) {
          const parsed: unknown = JSON.parse(
            readFileSync(credentialStoragePath, "utf8"),
          )
          if (parsed !== null && typeof parsed === "object") {
            pairedIds = new Set(Object.keys(parsed))
          }
        }
      } catch (e) {
        logError(e)
      }

      const deviceState = Object.values(getState()?.devices ?? {})

      res.send({
        devices: devices.map((device) => ({
          ...device,
          registered: pairedIds.has(device.id),
          activity: deviceState.find((d) => d?.id === device.id)?.activity,
        })),
      })
    } catch (e) {
      logError(e)
      res.status(500).send()
    }
  })

  app.post("/api/acquire-authentication-link", async (req, res) => {
    let success = false
    try {
      const { device } = req.body as { device: IDiscoveredDevice }
      debug(`connecting to device: '${device.id}'`)

      await handleDeviceAuthentication(device, credentialStoragePath, {
        onPerformLogin: async (url) => {
          success = true
          res.status(200).send(url)
          return undefined as unknown as string
        },
        onPrompt: async (pt) => {
          debugPa(pt)
          return ""
        },
      })
    } catch (e) {
      if (!success) {
        logError(e)
        res.status(500).send(e?.toString())
      }
    }
  })

  app.post("/api/connect", async (req, res) => {
    try {
      const { device, url, pin } = req.body as {
        device: IDiscoveredDevice
        url: string
        pin: string
      }
      debug(`connecting to device: '${device.id}'`)

      await handleDeviceAuthentication(device, credentialStoragePath, {
        onPerformLogin: async () => {
          return url
        },
        onPrompt: async (pt) => {
          debugPa(pt)
          return pin
        },
      })

      res.status(201).send()
    } catch (e) {
      logError(e)
      res.status(500).send(e?.toString())
    }
  })

  app.listen(port, () => {
    debug("Server listening on PORT:", port)
  })

  return app
}

async function handleDeviceAuthentication(
  device: IDiscoveredDevice,
  credentialStoragePath: string,
  handlers: {
    onPerformLogin: (url: string) => Promise<string>
    onPrompt: (promptText: string) => Promise<string>
  },
): Promise<void> {
  const x: IInputOutput = {
    logError: (e) => {
      logError(e)
    },
    logInfo: (m) => {
      debugPa(m)
    },
    logResult: (r) => {
      debugPa(r)
    },

    prompt: handlers.onPrompt,
  }

  const credentialRequester = new OauthCredentialRequester(x, {
    performLogin: handlers.onPerformLogin,
  })

  const cm = new CredentialManager(
    credentialRequester,
    new WriteOnlyStorage(new DiskCredentialsStorage(credentialStoragePath)),
  )

  const fd = await cm.getForDevice(device)

  debugPa(fd)
}
