import * as React from "react"
import { Search, X, Check, ChevronsUpDown, User, Plus, Phone, Mail, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Client } from "@/lib/queries/clients"

interface ClientSearchComboboxProps {
  clients: Client[]
  selectedClientId: string
  onSelectClient: (clientId: string) => void
  isLoading?: boolean
  disabled?: boolean
  error?: string | boolean
  onAddNewClient?: () => void
  placeholder?: string
  className?: string
}

export function ClientSearchCombobox({
  clients,
  selectedClientId,
  onSelectClient,
  isLoading = false,
  disabled = false,
  error,
  onAddNewClient,
  placeholder = "-- Select Existing CRM Client --",
  className
}: ClientSearchComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedClient = React.useMemo(() => {
    return clients.find((c) => c.id.toString() === selectedClientId)
  }, [clients, selectedClientId])

  // Filter clients based on typed word or words (multi-word match)
  const filteredClients = React.useMemo(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      return clients
    }
    const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
    return clients.filter((client) => {
      const searchTarget = [
        client.name,
        client.email,
        client.phone,
        client.address,
        client.notes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return words.every((word) => searchTarget.includes(word))
    })
  }, [clients, searchQuery])

  // Reset search and highlighted index when popover opens/closes
  React.useEffect(() => {
    if (open) {
      setSearchQuery("")
      setHighlightedIndex(0)
      // Focus the search input with slight delay for popover render
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  // Reset highlighted index when filter results change
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [searchQuery])

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!open || !listRef.current) return
    const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex, open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        filteredClients.length > 0 ? (prev + 1) % filteredClients.length : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        filteredClients.length > 0
          ? (prev - 1 + filteredClients.length) % filteredClients.length
          : 0
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredClients.length > 0 && filteredClients[highlightedIndex]) {
        onSelectClient(filteredClients[highlightedIndex].id.toString())
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectClient("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || (isLoading && clients.length === 0)}
          className={cn(
            "flex-1 h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium flex items-center justify-between transition-colors outline-none",
            "hover:border-gray-400 focus:border-[#111111] focus:ring-1 focus:ring-[#111111]",
            "disabled:opacity-50 disabled:cursor-not-allowed text-left",
            error ? "border-red-500 ring-1 ring-red-500" : "",
            className
          )}
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {selectedClient ? (
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-gray-900 truncate">
                  {selectedClient.name}
                </span>
                <span className="text-gray-400 font-normal text-[11px] truncate">
                  ({selectedClient.email || selectedClient.phone || "No contact info"})
                </span>
              </div>
            ) : (
              <span className="text-gray-400 font-normal truncate">
                {isLoading && clients.length === 0 ? "Loading clients..." : placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-gray-400">
            {selectedClient && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear client selection"
                className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleClear(e as unknown as React.MouseEvent)
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[500px] p-0 shadow-xl border border-[#e5e7eb] rounded-lg overflow-hidden bg-white z-50"
      >
        {/* Search Input */}
        <div className="flex items-center px-3 border-b border-gray-100 bg-gray-50/50">
          <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type words to search (name, phone, email)..."
            className="w-full px-2.5 py-2.5 text-xs bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("")
                inputRef.current?.focus()
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Results Info Bar */}
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            {searchQuery.trim()
              ? `Found ${filteredClients.length} of ${clients.length} clients`
              : `${clients.length} CRM clients available`}
          </span>
          {searchQuery.trim() && (
            <span className="text-[10px] text-gray-400">Press Enter to select</span>
          )}
        </div>

        {/* Clients List */}
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto divide-y divide-gray-50 p-1"
        >
          {isLoading && clients.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              <span className="text-xs">Loading CRM clients...</span>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-6 px-4 text-center">
              <p className="text-xs text-gray-500">
                No clients match <span className="font-semibold text-gray-800">"{searchQuery}"</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Try searching with different keywords or add a new client.
              </p>
              {onAddNewClient && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs h-7 gap-1 border-[#e5e7eb] hover:bg-gray-50"
                  onClick={() => {
                    setOpen(false)
                    onAddNewClient()
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add New Client
                </Button>
              )}
            </div>
          ) : (
            filteredClients.map((client, index) => {
              const isSelected = client.id.toString() === selectedClientId
              const isHighlighted = index === highlightedIndex

              return (
                <div
                  key={client.id}
                  onClick={() => {
                    onSelectClient(client.id.toString())
                    setOpen(false)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-xs transition-colors",
                    isHighlighted ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50",
                    isSelected ? "font-semibold" : ""
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <span className="text-xs text-gray-900 truncate flex items-center gap-1.5 font-medium">
                      {client.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                      {client.phone && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5 opacity-60" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="inline-flex items-center gap-0.5 truncate max-w-[200px]">
                          <Mail className="h-2.5 w-2.5 opacity-60" />
                          {client.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center pl-2">
                    {isSelected ? (
                      <Check className="h-4 w-4 text-emerald-600 font-bold" />
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
