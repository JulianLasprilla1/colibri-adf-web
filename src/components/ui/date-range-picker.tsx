"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"

interface DateRangePickerProps {
  onUpdate: (value: { range?: DateRange }) => void
  initialDate: { from: Date; to: Date }
}

export function DateRangePicker({ onUpdate, initialDate }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onUpdate({ range })
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className="w-[260px] justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {initialDate?.from ? (
            initialDate.to ? (
              <>
                {format(initialDate.from, "dd/MM/yyyy")} -{" "}
                {format(initialDate.to, "dd/MM/yyyy")}
              </>
            ) : (
              format(initialDate.from, "dd/MM/yyyy")
            )
          ) : (
            <span>Seleccionar rango</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={initialDate.from}
          selected={initialDate}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
