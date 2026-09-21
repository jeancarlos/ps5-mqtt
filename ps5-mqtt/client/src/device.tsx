import * as Grommet from "grommet"
import * as GrommetIcons from "grommet-icons"
import React from "react"
import { Authenticate } from "./authenticate"
import { AppContext } from "./context"
import type { IDevice } from "./types"

export const Device: React.FC<{
  device: IDevice
  onRefresh?: () => Promise<void> | void
}> = ({ device, onRefresh }) => {
  const { api } = React.useContext(AppContext)
  const [authUrl, setAuthUrl] = React.useState<string>("")

  const [acquiringLink, setAcquiringLink] = React.useState(false)

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
      <Grommet.Card
        animation={[
          { type: "zoomIn", duration: 500, size: "large" },
          { type: "fadeIn", duration: 500, size: "large" },
        ]}
      >
        <Grommet.CardHeader pad="medium" justify="between">
          <Grommet.Heading level="2" margin={{ vertical: "none" }}>
            {device.name}
          </Grommet.Heading>
          <Grommet.Tag
            size="small"
            value={device.registered ? "Paired" : "Not paired"}
            background={device.registered ? "status-ok" : "status-warning"}
            border={false}
          />
        </Grommet.CardHeader>
        <Grommet.CardBody pad={{ bottom: "medium" }}>
          <Grommet.DataTable
            columns={[
              { property: "key", primary: true, header: "Property" },
              { property: "value", header: "Value" },
            ]}
            data={Object.keys(device)
              .filter((k) => k !== "extras")
              .sort()
              .map((key) => ({
                key,
                value:
                  typeof device[key] === "object"
                    ? JSON.stringify(device[key])
                    : device[key],
              }))}
            step={10}
          />
        </Grommet.CardBody>
        <Grommet.CardFooter pad={{ horizontal: "small" }}>
          <Grommet.Button
            size="small"
            icon={<GrommetIcons.Connect size="small" />}
            label={device.registered ? "Re-authenticate" : "Authenticate"}
            onClick={onAuthenticate}
            disabled={acquiringLink}
            tip={"Authenticate"}
          />
        </Grommet.CardFooter>
      </Grommet.Card>

      {!!authUrl && (
        <Grommet.Layer onEsc={onAuthExit} onClickOutside={onAuthExit}>
          <Authenticate url={authUrl} onDone={onAuthExit} device={device} />
        </Grommet.Layer>
      )}
    </>
  )
}
