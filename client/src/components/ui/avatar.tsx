import * as React from "react"
import { cn } from "@/lib/utils"
import { User } from "lucide-react"

interface AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm", 
  lg: "h-12 w-12 text-base"
}

export function Avatar({ 
  src, 
  alt = "Avatar", 
  fallback, 
  size = "md", 
  className 
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false)
  
  const handleImageError = () => {
    setImageError(true)
  }

  // Generate initials from fallback text
  const getInitials = (text?: string) => {
    if (!text) return ""
    return text
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const initials = getInitials(fallback)

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        sizeClasses[size],
        className
      )}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={handleImageError}
          className="aspect-square h-full w-full object-cover"
        />
      ) : initials ? (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-600 font-medium">
          {initials}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
          <User className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  )
}