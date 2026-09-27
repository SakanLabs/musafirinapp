import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  children: React.ReactNode
  trigger: React.ReactNode
  align?: "start" | "end"
  className?: string
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
}

interface DropdownMenuSeparatorProps {
  className?: string
}

const DropdownMenuContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {}
})

export function DropdownMenu({ children, trigger, align = "end", className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative" ref={dropdownRef}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="cursor-pointer"
        >
          {trigger}
        </div>
        
        {isOpen && (
          <div
            className={cn(
              "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 text-gray-950 shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              align === "end" ? "right-0" : "left-0",
              "top-full mt-1",
              className
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownMenuContext.Provider>
  )
}

export function DropdownMenuItem({ children, onClick, className, disabled = false }: DropdownMenuItemProps) {
  const { setIsOpen } = React.useContext(DropdownMenuContext)

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
      setIsOpen(false)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        disabled
          ? "pointer-events-none opacity-50"
          : "hover:bg-gray-100 focus:bg-gray-100 cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
  return (
    <div
      className={cn("-mx-1 my-1 h-px bg-gray-200", className)}
    />
  )
}

export function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("px-2 py-1.5 text-sm font-semibold text-gray-900", className)}
    >
      {children}
    </div>
  )
}