"use client";

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type SonnerStyle = React.CSSProperties & {
  "--normal-bg"?: string
  "--normal-text"?: string
  "--normal-border"?: string
}

type ToasterProps = React.ComponentPropsWithoutRef<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const normalizedTheme = theme === "light" || theme === "dark" || theme === "system" ? theme : "system"

  return (
    <Sonner
      theme={normalizedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as SonnerStyle
      }
      {...props}
    />
  )
}

export { Toaster }
