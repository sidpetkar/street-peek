export function LoadingDots() {
  return (
    <div className="flex items-center h-[48px] px-6 rounded-full bg-white shadow-xl space-x-2">
      <span className="text-[16px] text-gray-900">Taking you places</span>
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
      </div>
    </div>
  )
} 