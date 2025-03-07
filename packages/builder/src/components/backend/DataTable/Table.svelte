<script>
  import { fade } from "svelte/transition"
  import { goto, params } from "@roxi/routify"
  import { Table, Modal, Heading, notifications, Layout } from "@budibase/bbui"
  import api from "builderStore/api"
  import Spinner from "components/common/Spinner.svelte"
  import DeleteRowsButton from "./buttons/DeleteRowsButton.svelte"
  import CreateEditRow from "./modals/CreateEditRow.svelte"
  import CreateEditUser from "./modals/CreateEditUser.svelte"
  import CreateEditColumn from "./modals/CreateEditColumn.svelte"
  import { TableNames, UNEDITABLE_USER_FIELDS } from "constants"
  import RoleCell from "./cells/RoleCell.svelte"

  export let schema = {}
  export let data = []
  export let tableId
  export let title
  export let allowEditing = false
  export let loading = false
  export let hideAutocolumns
  export let rowCount
  export let type
  export let disableSorting = false

  let selectedRows = []
  let editableColumn
  let editableRow
  let editRowModal
  let editColumnModal
  let customRenderers = []

  $: isInternal = type !== "external"
  $: isUsersTable = tableId === TableNames.USERS
  $: data && resetSelectedRows()
  $: editRowComponent = isUsersTable ? CreateEditUser : CreateEditRow
  $: {
    if (isUsersTable) {
      customRenderers = [
        {
          column: "roleId",
          component: RoleCell,
        },
      ]
      UNEDITABLE_USER_FIELDS.forEach(field => {
        if (schema[field]) {
          schema[field].editable = false
        }
      })
      if (schema.email) {
        schema.email.displayName = "Email"
      }
      if (schema.roleId) {
        schema.roleId.displayName = "Role"
      }
      if (schema.firstName) {
        schema.firstName.displayName = "First Name"
      }
      if (schema.lastName) {
        schema.lastName.displayName = "Last Name"
      }
      if (schema.status) {
        schema.status.displayName = "Status"
      }
    }
  }

  const resetSelectedRows = () => {
    selectedRows = []
  }

  const selectRelationship = ({ tableId, rowId, fieldName }) => {
    $goto(
      `/builder/app/${$params.application}/data/table/${tableId}/relationship/${rowId}/${fieldName}`
    )
  }

  const deleteRows = async () => {
    await api.delete(`/api/${tableId}/rows`, {
      rows: selectedRows,
    })
    data = data.filter(row => !selectedRows.includes(row))
    notifications.success(`Successfully deleted ${selectedRows.length} rows`)
    selectedRows = []
  }

  const editRow = row => {
    editableRow = row
    if (row) {
      editRowModal.show()
    }
  }

  const editColumn = field => {
    editableColumn = schema?.[field]
    if (editableColumn) {
      editColumnModal.show()
    }
  }
</script>

<Layout noPadding gap="S">
  <div>
    <div class="table-title">
      {#if title}
        <Heading size="S">{title}</Heading>
      {/if}
      {#if loading}
        <div transition:fade|local>
          <Spinner size="10" />
        </div>
      {/if}
    </div>
    <div class="popovers">
      <slot />
      {#if !isUsersTable && selectedRows.length > 0}
        <DeleteRowsButton on:updaterows {selectedRows} {deleteRows} />
      {/if}
    </div>
  </div>
  {#key tableId}
    <div class="table-wrapper" in:fade={{ delay: 200, duration: 100 }}>
      <Table
        {data}
        {schema}
        {loading}
        {customRenderers}
        {rowCount}
        {disableSorting}
        bind:selectedRows
        allowSelectRows={allowEditing && !isUsersTable}
        allowEditRows={allowEditing}
        allowEditColumns={allowEditing && isInternal}
        showAutoColumns={!hideAutocolumns}
        on:editcolumn={e => editColumn(e.detail)}
        on:editrow={e => editRow(e.detail)}
        on:clickrelationship={e => selectRelationship(e.detail)}
        on:sort
      />
    </div>
  {/key}
</Layout>

<Modal bind:this={editRowModal}>
  <svelte:component this={editRowComponent} on:updaterows row={editableRow} />
</Modal>
<Modal bind:this={editColumnModal}>
  <CreateEditColumn
    field={editableColumn}
    on:updatecolumns
    onClosed={editColumnModal.hide}
  />
</Modal>

<style>
  .table-title {
    height: 24px;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
  }
  .table-title > div {
    margin-left: var(--spacing-xs);
  }
  .table-wrapper {
    overflow: hidden;
  }

  .popovers {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: var(--spacing-s);
  }
  .popovers :global(button) {
    font-weight: 600;
    margin-top: var(--spacing-l);
  }
  .popovers :global(button svg) {
    margin-right: var(--spacing-xs);
  }
</style>
