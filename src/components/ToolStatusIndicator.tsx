interface ToolStatusIndicatorProps {
  descriptionKo: string
}

export function ToolStatusIndicator({ descriptionKo }: ToolStatusIndicatorProps) {
  return (
    <div className="tool-status">
      <span className="tool-status-icon">&#9881;</span>
      <span>{descriptionKo}...</span>
    </div>
  )
}
