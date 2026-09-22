import * as Grommet from "grommet"
import * as GrommetIcons from "grommet-icons"
import React from "react"
import { AppContext } from "./context"
import type { IPsnAccount } from "./types"

const SSO_COOKIE_URL = "https://ca.account.sony.com/api/v1/ssocookie"

const DAY_MS = 86400000

// The Sony page is HTTPS and this app is HTTP, so an active request from there
// to here is blocked as mixed content. A top-level navigation is not, and the
// fragment never reaches the server or its logs. The receiving page strips it
// from history immediately.
const bookmarklet = (origin: string) =>
  "javascript:(function(){try{var j=JSON.parse(document.body.innerText);" +
  "if(!j.npsso){alert('Open the Sony token page first.');return}" +
  "location.replace('" +
  origin +
  "/#npsso='+encodeURIComponent(j.npsso))}catch(e){" +
  "alert('No token found on this page.')}})()" 

export const PsnAccountStatus: React.FC = () => {
  const { api } = React.useContext(AppContext)
  const [account, setAccount] = React.useState<IPsnAccount | undefined>()
  const [open, setOpen] = React.useState(false)
  const [npsso, setNpsso] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>()

  const load = React.useCallback(async () => {
    setAccount(await api.getPsnAccount())
  }, [api])

  React.useEffect(() => {
    load()
  }, [load])

  // Arrives by fragment from the bookmarklet. Cleared from history before the
  // request so the token is not left sitting in the address bar or back stack.
  React.useEffect(() => {
    const match = /[#&]npsso=([^&]+)/.exec(window.location.hash)
    if (match === null) {
      return
    }
    const token = decodeURIComponent(match[1])
    window.history.replaceState(null, "", window.location.pathname)
    ;(async () => {
      setBusy(true)
      const failure = await api.connectPsnAccount(token)
      setBusy(false)
      if (failure !== undefined) {
        setError(failure)
        setOpen(true)
        return
      }
      await load()
    })()
  }, [api, load])

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      // The server validates against Sony before storing, so a rejection here
      // is a real answer rather than a guess made in the browser.
      const failure = await api.connectPsnAccount(npsso.trim())
      if (failure !== undefined) {
        setError(failure)
        return
      }
      setNpsso("")
      setOpen(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const expiresInMs = account?.expiresInMs
  const expired = expiresInMs !== undefined && expiresInMs !== null && expiresInMs <= 0
  const expiringSoon =
    expiresInMs !== undefined && expiresInMs !== null && expiresInMs > 0 && expiresInMs < 7 * DAY_MS

  const label = !account?.connected
    ? "No PSN account"
    : expired
      ? "PSN token expired"
      : expiringSoon
        ? `PSN expires in ${Math.ceil((expiresInMs as number) / DAY_MS)}d`
        : (account.accountName ?? "PSN connected")

  return (
    <>
      <Grommet.Button
        size="small"
        icon={<GrommetIcons.User size="small" />}
        label={label}
        onClick={() => setOpen(true)}
        // Amber rather than red while it still works: this is a deadline, not
        // an outage, and it should read differently from a broken integration.
        color={expired ? "status-critical" : expiringSoon ? "status-warning" : undefined}
      />

      {open && (
        <Grommet.Layer onEsc={() => setOpen(false)} onClickOutside={() => setOpen(false)}>
          <Grommet.Box pad="medium" gap="small" width="large">
            <Grommet.Heading level="3" margin="none">
              PSN account
            </Grommet.Heading>

            <Grommet.Text size="small" color="text-weak">
              {account?.connected
                ? `Connected as ${account.accountName ?? "unknown"}.`
                : "Presence and the running title need an account. The console still wakes without one."}
            </Grommet.Text>

            <Grommet.Text size="small" color="text-weak">
              Sign in to PlayStation in this browser, open the link below, and paste
              the npsso value it returns.
            </Grommet.Text>

            <Grommet.Anchor
              href={SSO_COOKIE_URL}
              target="_blank"
              rel="noreferrer"
              label="Open the token page"
              icon={<GrommetIcons.Link size="small" />}
            />

            <Grommet.Box gap="xsmall">
              <Grommet.Text size="small" color="text-weak">
                Or drag this to the bookmarks bar and click it while on the
                token page — it fills this in for you.
              </Grommet.Text>
              <Grommet.Anchor
                href={bookmarklet(window.location.origin)}
                label="Send npsso to ps5-mqtt"
                onClick={(e: React.MouseEvent) => e.preventDefault()}
              />
            </Grommet.Box>

            <Grommet.TextInput
              placeholder="npsso"
              value={npsso}
              onChange={(e) => setNpsso(e.target.value)}
            />

            {!!error && (
              <Grommet.Text size="small" color="status-critical">
                {error}
              </Grommet.Text>
            )}

            <Grommet.Box direction="row" gap="small" justify="end">
              <Grommet.Button size="small" label="Cancel" onClick={() => setOpen(false)} />
              <Grommet.Button
                size="small"
                primary
                label={busy ? "Checking…" : "Connect"}
                onClick={submit}
                disabled={busy || npsso.trim() === ""}
              />
            </Grommet.Box>
          </Grommet.Box>
        </Grommet.Layer>
      )}
    </>
  )
}
