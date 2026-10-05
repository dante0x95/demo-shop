import { Checkbox, Label, Prompt, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { AdminMetafieldDefinition } from "../../../../lib/metafields"

type DeleteMetafieldDefinitionPromptProps = {
  // The definition to delete; the prompt is open while it is set.
  definition: AdminMetafieldDefinition | null
  onCancel: () => void
  onConfirm: (definition: AdminMetafieldDefinition, deleteValues: boolean) => void
}

// Deleting keeps the definition's values by default (they become
// unstructured); the admin can choose to delete them too.
export const DeleteMetafieldDefinitionPrompt = ({
  definition,
  onCancel,
  onConfirm,
}: DeleteMetafieldDefinitionPromptProps) => {
  const [deleteValues, setDeleteValues] = useState(false)

  useEffect(() => {
    if (definition) {
      setDeleteValues(false)
    }
  }, [definition])

  return (
    <Prompt
      open={Boolean(definition)}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Delete metafield definition?</Prompt.Title>
          <Prompt.Description>
            {`"${definition?.label ?? ""}" will be deleted. Its values are kept as unstructured metafields: hidden from the storefront and connected again if you create a definition with the key ${definition?.key ?? ""}.`}
          </Prompt.Description>
          <div className="flex items-start gap-x-2 pt-4">
            <Checkbox
              id="delete-metafield-values"
              checked={deleteValues}
              onCheckedChange={(checked) => setDeleteValues(checked === true)}
            />
            <div className="flex flex-col gap-y-1">
              <Label
                htmlFor="delete-metafield-values"
                size="small"
                weight="plus"
              >
                Also delete its values
              </Label>
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                Removes the value from every item that has one. This can't be
                undone.
              </Text>
            </div>
          </div>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Cancel</Prompt.Cancel>
          <Prompt.Action
            onClick={() => {
              if (definition) {
                onConfirm(definition, deleteValues)
              }
            }}
          >
            Delete
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
