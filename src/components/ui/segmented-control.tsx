import { For } from "solid-js"
import * as RadioGroupPrimitive from "@kobalte/core/radio-group"
import { cn } from "~/lib/utils"

export type SegmentedControlOption = {
  value: string
  label: string
}

type SegmentedControlProps = {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  class?: string
}

const SegmentedControl = (props: SegmentedControlProps) => {
  return (
    <RadioGroupPrimitive.Root
      value={props.value}
      onChange={props.onChange}
      class={cn(
        "inline-flex items-center rounded-full bg-gray-200 shadow-sm p-[2px]",
        props.class
      )}
      orientation="horizontal"
    >
      <For each={props.options}>
        {(option) => (
          <RadioGroupPrimitive.Item value={option.value} class="flex">
            <RadioGroupPrimitive.ItemInput class="sr-only" />
            <RadioGroupPrimitive.ItemControl class="flex cursor-pointer select-none items-center justify-center rounded-full px-4 py-1 text-sm font-medium transition-colors duration-200 text-gray-500 hover:text-gray-700 data-[checked]:bg-white data-[checked]:shadow data-[checked]:text-gray-800">
              <RadioGroupPrimitive.ItemLabel class="cursor-pointer">
                {option.label}
              </RadioGroupPrimitive.ItemLabel>
            </RadioGroupPrimitive.ItemControl>
          </RadioGroupPrimitive.Item>
        )}
      </For>
    </RadioGroupPrimitive.Root>
  )
}

export { SegmentedControl }
