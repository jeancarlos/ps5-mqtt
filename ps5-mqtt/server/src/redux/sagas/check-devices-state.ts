import createDebugger from "debug"
import { call, getContext, put, select } from "redux-saga/effects"
import type { PlayactorClient } from "../../playactor/client"
import { PLAYACTOR_CLIENT } from "../../services"
import { createErrorLogger } from "../../util/error-logger"
import { updateHomeAssistant } from "../action-creators"
import { markPoll } from "../../health"
import { getDeviceList } from "../selectors"
import type { Device } from "../types"

const debug = createDebugger("@ha:ps5:checkDevicesState")
const errorLogger = createErrorLogger()

function* checkDevicesState() {
  const playactor: PlayactorClient = yield getContext(PLAYACTOR_CLIENT)

  markPoll()

  const devices: Device[] = yield select(getDeviceList)
  for (const device of devices) {
    try {
      const updatedDevice: Device = yield call(
        [playactor, playactor.check],
        device.address.address,
      )

      if (device.transitioning) {
        debug(
          "Device is transitioning",
          device.transitioning,
          updatedDevice.status,
        )
        break
      }

      // only send updates if ps5 is truly changing states or when ps5 has become available
      if (device.status !== updatedDevice.status || !device.available) {
        debug("Update HA")
        yield put(
          updateHomeAssistant({
            ...device,
            status: updatedDevice.status,
            activity:
              updatedDevice.status !== "AWAKE"
                ? undefined
                : updatedDevice.activity,
            available: true,
          }),
        )
      }
    } catch (e) {
      // A previously available PS5 cannot be located. Availability and power
      // are separate facts, and the payload already carries device_status for
      // the first one. Publishing power: "UNKNOWN" additionally destroys the
      // last known value, and consumers that only map AWAKE/STANDBY - the Home
      // Assistant switch among them - silently freeze at whatever they held.
      // Keep the last known power and let device_status say it is unreachable.
      yield put(
        updateHomeAssistant({
          ...device,
          available: false,
          activity: undefined,
        }),
      )

      errorLogger(e)
    }
  }
}

export { checkDevicesState }
