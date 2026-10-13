import { restorePersistedPsnAccounts } from "../app"
import { PsnAccount } from "../psn-account"
import { PsnAuthStore } from "../psn-auth-store"
import { updateAccount } from "../redux/action-creators"
import type { Account, State } from "../redux/types"

jest.mock("../psn-account")
jest.mock("../psn-auth-store")

const mockedList = jest.mocked(PsnAuthStore.list)
const mockedRestoreFromStore = jest.mocked(PsnAccount.restoreFromStore)

const authInfo = {
  accessToken: "access-token",
  accessTokenExpiration: 1,
  refreshToken: "refresh-token",
  refreshTokenExpiration: 2,
}

const stored = (accountId?: string): PsnAuthStore.StoredAccountAuthInfo => ({
  npssoHash: "hash",
  accountId,
  accountName: accountId,
  authInfo,
  updatedAt: "2026-01-01T00:00:00.000Z",
})

const restored = (accountId: string) => ({
  accountName: accountId,
  accountId,
  npsso: "",
  authInfo,
})

describe("restorePersistedPsnAccounts", () => {
  test("restores saved accounts the config did not already bootstrap", async () => {
    const configured = { ...restored("configured"), preferredDevices: {} }
    const state: State = {
      devices: {},
      accounts: { configured: configured as Account },
    }
    mockedList.mockResolvedValue([
      stored("configured"),
      stored(undefined),
      stored("broken"),
      stored("ui-added"),
    ])
    mockedRestoreFromStore.mockImplementation(async ({ accountId }) => {
      if (accountId === "broken") {
        throw new Error("refresh token expired")
      }
      return restored(accountId as string)
    })
    const dispatch = jest.fn()

    await restorePersistedPsnAccounts(() => state, dispatch)

    expect(mockedRestoreFromStore).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      updateAccount({ ...restored("ui-added"), preferredDevices: {} }),
    )
  })
})
