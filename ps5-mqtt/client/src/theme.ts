import { grommet, ThemeType } from "grommet"
import { deepMerge } from "grommet/utils"

// Every colour below carries both a dark and a light value. Flat hex strings
// look fine in one mode and wrong in the other, which is what made the theme
// toggle appear to do nothing.
const theme = deepMerge(grommet, <ThemeType>{
  global: {
    colors: {
      active: { dark: "#2f2f2f", light: "#e6e6e6" },
      page: { dark: "#121212", light: "#f4f5f7" },
      "app-bar": { dark: "#191919", light: "#ffffff" },
      surface: { dark: "#1e1e1e", light: "#ffffff" },
      "surface-raised": { dark: "#262626", light: "#eef0f3" },
      border: { dark: "#333333", light: "#d9dde3" },
      text: { dark: "#ececec", light: "#1b1f24" },
      "text-weak": { dark: "#a8a8a8", light: "#5b6470" },
      awake: { dark: "#3ddc84", light: "#1a7f4b" },
      standby: { dark: "#8a8a8a", light: "#6b7280" },
    },
    font: {
      size: "16px",
      height: "22px",
    },
    input: {
      weight: 400,
    },
    size: {
      avatar: "36px",
      sidebar: "60px",
    },
    elevation: {
      dark: {
        small: "0px 2px 6px rgba(0, 0, 0, 0.55)",
        medium: "0px 6px 16px rgba(0, 0, 0, 0.55)",
      },
      light: {
        small: "0px 2px 6px rgba(16, 24, 40, 0.08)",
        medium: "0px 6px 16px rgba(16, 24, 40, 0.10)",
      },
    },
  },
  icon: {
    size: {
      medium: "18px",
    },
  },
  paragraph: {
    medium: { size: "16px", height: "22px" },
    large: { size: "20px", height: "26px" },
  },
  card: {
    container: {
      background: { dark: "surface", light: "surface" },
      elevation: "small",
      round: "small",
    },
    header: {
      background: { dark: "surface-raised", light: "surface-raised" },
      pad: "medium",
    },
    body: {
      pad: "medium",
    },
    footer: {
      background: { dark: "surface-raised", light: "surface-raised" },
      pad: { horizontal: "medium", vertical: "small" },
    },
  },
  layer: {
    background: { dark: "surface", light: "surface" },
  },
})

export default theme
