<script>
  import { fade } from "svelte/transition"
  import { tables } from "stores/backend"
  import CreateRowButton from "./buttons/CreateRowButton.svelte"
  import CreateColumnButton from "./buttons/CreateColumnButton.svelte"
  import CreateViewButton from "./buttons/CreateViewButton.svelte"
  import ExportButton from "./buttons/ExportButton.svelte"
  import EditRolesButton from "./buttons/EditRolesButton.svelte"
  import ManageAccessButton from "./buttons/ManageAccessButton.svelte"
  import HideAutocolumnButton from "./buttons/HideAutocolumnButton.svelte"
  import TableFilterButton from "./buttons/TableFilterButton.svelte"
  import Table from "./Table.svelte"
  import { TableNames } from "constants"
  import CreateEditRow from "./modals/CreateEditRow.svelte"
  import { fetchTableData } from "helpers/fetchTableData"
  import { Pagination } from "@budibase/bbui"

  let hideAutocolumns = true
  let schema
  $: isUsersTable = $tables.selected?._id === TableNames.USERS
  $: type = $tables.selected?.type
  $: isInternal = type !== "external"
  $: {
    schema = $tables.selected?.schema

    // Manually add these as we don't want them to be 'real' auto-columns
    schema._id = {
      type: "internal",
      editable: false,
      displayName: "ID",
      autocolumn: true,
    }
    if (isInternal) {
      schema._rev = {
        type: "internal",
        editable: false,
        displayName: "Revision",
        autocolumn: true,
      }
    }
  }
  $: id = $tables.selected?._id
  $: search = searchTable(id)
  $: columnOptions = Object.keys($search.schema || {})

  // Fetches new data whenever the table changes
  const searchTable = tableId => {
    return fetchTableData({
      tableId,
      schema,
      limit: 10,
      paginate: true,
    })
  }

  // Fetch data whenever sorting option changes
  const onSort = e => {
    search.update({
      sortColumn: e.detail.column,
      sortOrder: e.detail.order,
    })
  }

  // Fetch data whenever filters change
  const onFilter = e => {
    search.update({
      filters: e.detail,
    })
  }

  // Fetch data whenever schema changes
  const onUpdateColumns = () => {
    search.update({
      schema,
    })
  }

  // Fetch data whenever rows are modified. Unfortunately we have to lose
  // our pagination place, as our bookmarks will have shifted.
  const onUpdateRows = () => {
    search.update()
  }
</script>

<div>
  <Table
    title={$tables.selected?.name}
    {schema}
    {type}
    tableId={id}
    data={$search.rows}
    bind:hideAutocolumns
    loading={$search.loading}
    on:sort={onSort}
    allowEditing
    disableSorting
    on:updatecolumns={onUpdateColumns}
    on:updaterows={onUpdateRows}
  >
    {#if isInternal}
      <CreateColumnButton on:updatecolumns={onUpdateColumns} />
    {/if}
    {#if schema && Object.keys(schema).length > 0}
      {#if !isUsersTable}
        <CreateRowButton
          on:updaterows={onUpdateRows}
          title={"Create row"}
          modalContentComponent={CreateEditRow}
        />
      {/if}
      {#if isInternal}
        <CreateViewButton />
      {/if}
      <ManageAccessButton resourceId={$tables.selected?._id} />
      {#if isUsersTable}
        <EditRolesButton />
      {/if}
      <HideAutocolumnButton bind:hideAutocolumns />
      <!-- always have the export last -->
      <ExportButton view={$tables.selected?._id} />
      {#key id}
        <TableFilterButton {schema} on:change={onFilter} />
      {/key}
    {/if}
  </Table>
  {#key id}
    <div in:fade={{ delay: 200, duration: 100 }}>
      <div class="pagination">
        <Pagination
          page={$search.pageNumber + 1}
          hasPrevPage={$search.hasPrevPage}
          hasNextPage={$search.hasNextPage}
          goToPrevPage={$search.loading ? null : search.prevPage}
          goToNextPage={$search.loading ? null : search.nextPage}
        />
      </div>
    </div>
  {/key}
</div>

<style>
  .pagination {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    margin-top: var(--spacing-xl);
  }
</style>
