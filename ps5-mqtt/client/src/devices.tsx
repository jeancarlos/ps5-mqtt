import * as Grommet from "grommet"
import * as GrommetIcons from "grommet-icons"
import React from "react"
import { Loader } from "./app"
import { AppContext } from "./context"
import { Device } from "./device"
import type { IDevice } from "./types"

export const Devices: React.FC = () => {
  const { api } = React.useContext(AppContext)
  const [devices, setDevices] = React.useState<IDevice[] | undefined>()
  const [isDiscovering, setIsDiscovering] = React.useState<boolean>(false)
  const [failed, setFailed] = React.useState<boolean>(false)

  const refresh = React.useCallback(async () => {
    setIsDiscovering(true)
    try {
      // getDevices resolves undefined on any failure. Assigning that straight
      // to state would drop a good list on a transient error and leave the
      // view claiming it is still searching.
      const found = await api.getDevices()
      setFailed(found === undefined)
      if (found !== undefined) {
        setDevices(found)
      }
    } finally {
      setIsDiscovering(false)
    }
  }, [api])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Grommet.Box pad={{ horizontal: "medium", vertical: "large" }} gap="medium">
      <Grommet.Box direction="row" justify="between" align="center">
        <Grommet.Text color="text-weak" size="small">
          {isDiscovering
            ? "Looking for consoles…"
            : failed
              ? "Discovery failed — showing the last result"
              : devices === undefined
                ? "Looking for consoles…"
                : `${devices.length} console${devices.length === 1 ? "" : "s"} found`}
        </Grommet.Text>
        <Grommet.Button
          size="small"
          icon={<GrommetIcons.Refresh size="small" />}
          label="Refresh"
          onClick={refresh}
          disabled={isDiscovering}
        />
      </Grommet.Box>

      {isDiscovering && devices === undefined && <Loader />}

      {!isDiscovering && !failed && devices?.length === 0 && (
        <Grommet.Box
          pad="large"
          align="center"
          gap="xsmall"
          background="surface"
          round="small"
        >
          <Grommet.Text weight={500}>No consoles found</Grommet.Text>
          <Grommet.Text size="small" color="text-weak" textAlign="center">
            Discovery is sent to the configured broadcast address. Check that
            the console is on the same network.
          </Grommet.Text>
        </Grommet.Box>
      )}

      {!!devices?.length && (
        <Grommet.Grid columns={{ count: "fill", size: "medium" }} gap="medium">
          {devices.map((d) => (
            <Device device={d} key={d.id} onRefresh={refresh} />
          ))}
        </Grommet.Grid>
      )}
    </Grommet.Box>
  )
}
