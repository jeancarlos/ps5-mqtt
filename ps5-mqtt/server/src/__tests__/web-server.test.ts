import express from "express"
import { createServer, Server } from "http"
import type { AddressInfo } from "net"
import { PsnAccount } from "../psn-account"
import { updateAccount } from "../redux/action-creators"
import type { Account, State } from "../redux/types"
import type { Settings } from "../services"
import { setupWebserver } from "../web-server"

jest.mock("../psn-account")

const mockedExchangeNpssoForPsnAccount = jest.mocked(
  PsnAccount.exchangeNpssoForPsnAccount,
)

describe("web server", () => {
  const dispatch = jest.fn()
  let state: State | undefined
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    jest
      .spyOn(express.application, "listen")
      .mockReturnValue(undefined as never)
    const app = setupWebserver(
      0,
      { credentialStoragePath: "/nonexistent" } as Settings,
      () => state,
      dispatch,
    )
    server = createServer(app)
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  beforeEach(() => {
    jest.clearAllMocks()
    state = undefined
  })

  const postPsnAccount = (body: unknown) =>
    fetch(`${baseUrl}/api/psn-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

  test("registers an accepted PSN account in the store", async () => {
    const account = {
      accountName: "player",
      accountId: "account-id",
      npsso: "npsso-value",
      authInfo: {
        accessToken: "access-token",
        accessTokenExpiration: 1,
        refreshToken: "refresh-token",
        refreshTokenExpiration: 2,
      },
    }
    mockedExchangeNpssoForPsnAccount.mockResolvedValue(account)

    const res = await postPsnAccount({ npsso: " npsso-value " })

    expect(res.status).toBe(200)
    expect(mockedExchangeNpssoForPsnAccount).toHaveBeenCalledWith(
      "npsso-value",
      undefined,
      dispatch,
    )
    expect(dispatch).toHaveBeenCalledWith(
      updateAccount({ ...account, preferredDevices: {} }),
    )
  })

  test("rejects a missing npsso without contacting Sony", async () => {
    const res = await postPsnAccount({ npsso: "  " })

    expect(res.status).toBe(400)
    expect(mockedExchangeNpssoForPsnAccount).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  const storedAccount: Account = {
    accountName: "player",
    accountId: "account-id",
    npsso: "npsso-value",
    authInfo: {
      accessToken: "access-token",
      accessTokenExpiration: 1,
      refreshToken: "refresh-token",
      refreshTokenExpiration: Date.now() + 60_000,
    },
    preferredDevices: { ps5: "ps5-id" },
  }

  test("keeps the preferred devices of an account that is connected again", async () => {
    state = { devices: {}, accounts: { "account-id": storedAccount } }
    const { preferredDevices, ...account } = storedAccount
    mockedExchangeNpssoForPsnAccount.mockResolvedValue(account)

    await postPsnAccount({ npsso: "npsso-value" })

    expect(dispatch).toHaveBeenCalledWith(
      updateAccount({ ...account, preferredDevices }),
    )
  })

  test("reports the account from the store without waiting for it to be saved", async () => {
    state = { devices: {}, accounts: { "account-id": storedAccount } }

    const res = await fetch(`${baseUrl}/api/psn-account`)

    expect(await res.json()).toMatchObject({
      connected: true,
      accountName: "player",
    })
  })
})
