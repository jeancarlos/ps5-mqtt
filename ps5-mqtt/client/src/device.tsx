import * as Grommet from "grommet"
import * as GrommetIcons from "grommet-icons"
import React from "react"
import { Authenticate } from "./authenticate"
import { AppContext } from "./context"
import type { IDevice } from "./types"

// "13600007" is how the console reports 13.60; the trailing digits are build
// noise. Anything unexpected is shown untouched rather than mangled.
const formatSystemVersion = (raw?: string): string | undefined => {
  if (!raw || !/^\d{4,}$/.test(raw)) {
    return raw
  }
  return `${Number(raw.slice(0, 2))}.${raw.slice(2, 4)}`
}

const Detail: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <Grommet.Box direction="row" justify="between" gap="medium" align="baseline">
    <Grommet.Text size="small" color="text-weak">
      {label}
    </Grommet.Text>
    <Grommet.Text size="small" weight={500} textAlign="end">
      {value ?? "—"}
    </Grommet.Text>
  </Grommet.Box>
)

export const Device: React.FC<{
  device: IDevice
  onRefresh?: () => Promise<void> | void
}> = ({ device, onRefresh }) => {
  const { api } = React.useContext(AppContext)
  const [authUrl, setAuthUrl] = React.useState<string | undefined>(undefined)
  const [acquiringLink, setAcquiringLink] = React.useState(false)

  const awake = device.status === "AWAKE"

  const onAuthenticate = async () => {
    setAcquiringLink(true)
    try {
      const url = await api.acquireAuthenticationLink(device)
      if (url !== undefined) {
        setAuthUrl(url)
      }
    } finally {
      setAcquiringLink(false)
    }
  }

  const onAuthExit = async (success?: boolean) => {
    setAuthUrl(undefined)
    if (success) {
      await onRefresh?.()
    }
  }

  return (
    <>
      <Grommet.Card width={{ min: "medium", max: "medium" }}>
        <Grommet.CardHeader>
          <Grommet.Box gap="xsmall">
            <Grommet.Heading level="3" margin="none">
              {device.name}
            </Grommet.Heading>
            <Grommet.Box direction="row" gap="xsmall" align="center">
              <Grommet.Box
                width="10px"
                height="10px"
                round="full"
                background={awake ? "awake" : "standby"}
              />
              <Grommet.Text size="small" color="text-weak">
                {awake ? "Awake" : "Standby"}
              </Grommet.Text>
            </Grommet.Box>
          </Grommet.Box>
          <Grommet.Tag
            size="small"
            value={device.registered ? "Paired" : "Not paired"}
            background={device.registered ? "awake" : "standby"}
            border={false}
          />
        </Grommet.CardHeader>

        <Grommet.CardBody gap="small">
          <Detail
            label="Address"
            value={
              device.address
                ? `${device.address.address}:${device.address.port}`
                : undefined
            }
          />
          <Detail label="Type" value={device.type} />
          <Detail
            label="System version"
            value={formatSystemVersion(device.systemVersion)}
          />
          <Detail label="Identifier" value={device.id} />
        </Grommet.CardBody>

        <Grommet.CardFooter>
          <Grommet.Button
            size="small"
            icon={<GrommetIcons.Connect size="small" />}
            label={device.registered ? "Re-authenticate" : "Authenticate"}
            onClick={onAuthenticate}
            disabled={acquiringLink}
          />
        </Grommet.CardFooter>
      </Grommet.Card>

      {!!authUrl && (
        <Grommet.Layer
          onEsc={() => onAuthExit()}
          onClickOutside={() => onAuthExit()}
        >
          <Authenticate url={authUrl} onDone={onAuthExit} device={device} />
        </Grommet.Layer>
      )}
    </>
  )
}
