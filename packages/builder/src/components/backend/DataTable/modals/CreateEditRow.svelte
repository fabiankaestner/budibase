<script>
  import { createEventDispatcher } from "svelte"
  import { tables, rows } from "stores/backend"
  import { notifications } from "@budibase/bbui"
  import RowFieldControl from "../RowFieldControl.svelte"
  import * as api from "../api"
  import { ModalContent } from "@budibase/bbui"
  import ErrorsBox from "components/common/ErrorsBox.svelte"
  import { FIELDS } from "constants/backend"

  const FORMULA_TYPE = FIELDS.FORMULA.type

  export let row = {}

  let errors = []
  const dispatch = createEventDispatcher()

  $: creating = row?._id == null
  $: table = row.tableId
    ? $tables.list.find(table => table._id === row?.tableId)
    : $tables.selected
  $: tableSchema = Object.entries(table?.schema ?? {})

  async function saveRow() {
    const rowResponse = await api.saveRow(
      { ...row, tableId: table._id },
      table._id
    )

    if (rowResponse.errors) {
      errors = Object.entries(rowResponse.errors)
        .map(([key, error]) => ({ dataPath: key, message: error }))
        .flat()
      // Prevent modal closing if there were errors
      return false
    } else if (rowResponse.status === 400 && rowResponse.validationErrors) {
      errors = Object.keys(rowResponse.validationErrors).map(field => ({
        message: `${field} ${rowResponse.validationErrors[field][0]}`,
      }))
      return false
    } else if (rowResponse.status === 500) {
      errors = [{ message: rowResponse.message }]
      return false
    }

    notifications.success("Row saved successfully.")
    rows.save(rowResponse)
    dispatch("updaterows")
  }
</script>

<ModalContent
  title={creating ? "Create Row" : "Edit Row"}
  confirmText={creating ? "Create Row" : "Save Row"}
  onConfirm={saveRow}
>
  <ErrorsBox {errors} />
  {#each tableSchema as [key, meta]}
    {#if !meta.autocolumn && meta.type !== FORMULA_TYPE}
      <div>
        <RowFieldControl {meta} bind:value={row[key]} />
      </div>
    {/if}
  {/each}
</ModalContent>

<style>
  div {
    min-width: 0;
  }
</style>
