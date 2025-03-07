<script>
  import { getContext, setContext } from "svelte"
  import { writable, get } from "svelte/store"
  import * as AppComponents from "components/app"
  import Router from "./Router.svelte"
  import { enrichProps, propsAreSame } from "utils/componentProps"
  import { builderStore } from "stores"
  import { hashString } from "utils/helpers"
  import Manifest from "manifest.json"
  import { getActiveConditions, reduceConditionActions } from "utils/conditions"
  import Placeholder from "components/app/Placeholder.svelte"

  export let instance = {}
  export let isLayout = false
  export let isScreen = false

  // The enriched component settings
  let enrichedSettings

  // Any prop overrides that need to be applied due to conditional UI
  let conditionalSettings

  // Props are hashed when inside the builder preview and used as a key, so that
  // components fully remount whenever any props change
  let propsHash = 0

  // Latest timestamp that we started a props update.
  // Due to enrichment now being async, we need to avoid overwriting newer
  // props with old ones, depending on how long enrichment takes.
  let latestUpdateTime

  // Keep track of stringified representations of context and instance
  // to avoid enriching bindings as much as possible
  let lastContextKey
  let lastInstanceKey

  // Visibility flag used by conditional UI
  let visible = true

  // Get contexts
  const context = getContext("context")
  const insideScreenslot = !!getContext("screenslot")

  // Create component context
  const componentStore = writable({})
  setContext("component", componentStore)

  // Extract component instance info
  $: constructor = getComponentConstructor(instance._component)
  $: definition = getComponentDefinition(instance._component)
  $: children = instance._children || []
  $: id = instance._id
  $: name = instance._instanceName
  $: interactive =
    $builderStore.inBuilder &&
    ($builderStore.previewType === "layout" || insideScreenslot)
  $: empty = interactive && !children.length && definition?.hasChildren
  $: emptyState = empty && definition?.showEmptyState !== false
  $: rawProps = getRawProps(instance)
  $: instanceKey = JSON.stringify(rawProps)
  $: updateComponentProps(rawProps, instanceKey, $context)
  $: selected =
    $builderStore.inBuilder &&
    $builderStore.selectedComponentId === instance._id
  $: inSelectedPath = $builderStore.selectedComponentPath?.includes(id)
  $: evaluateConditions(enrichedSettings?._conditions)
  $: componentSettings = { ...enrichedSettings, ...conditionalSettings }
  $: renderKey = `${propsHash}-${emptyState}`

  // Update component context
  $: componentStore.set({
    id,
    children: children.length,
    styles: { ...instance._styles, id, empty: emptyState, interactive },
    empty: emptyState,
    selected,
    name,
  })

  const getRawProps = instance => {
    let validProps = {}
    Object.entries(instance)
      .filter(([name]) => name === "_conditions" || !name.startsWith("_"))
      .forEach(([key, value]) => {
        validProps[key] = value
      })
    return validProps
  }

  // Gets the component constructor for the specified component
  const getComponentConstructor = component => {
    const split = component?.split("/")
    const name = split?.[split.length - 1]
    if (name === "screenslot" && $builderStore.previewType !== "layout") {
      return Router
    }
    return AppComponents[name]
  }

  const getComponentDefinition = component => {
    const prefix = "@budibase/standard-components/"
    const type = component?.replace(prefix, "")
    return type ? Manifest[type] : null
  }

  // Enriches any string component props using handlebars
  const updateComponentProps = (rawProps, instanceKey, context) => {
    const instanceSame = instanceKey === lastInstanceKey
    const contextSame = context.key === lastContextKey

    if (instanceSame && contextSame) {
      return
    } else {
      lastInstanceKey = instanceKey
      lastContextKey = context.key
    }

    // Record the timestamp so we can reference it after enrichment
    latestUpdateTime = Date.now()
    const enrichmentTime = latestUpdateTime

    // Enrich props with context
    const enrichedProps = enrichProps(rawProps, context)

    // Abandon this update if a newer update has started
    if (enrichmentTime !== latestUpdateTime) {
      return
    }

    // Update the component props.
    // Most props are deeply compared so that svelte will only trigger reactive
    // statements on props that have actually changed.
    if (!enrichedProps) {
      return
    }
    let propsChanged = false
    if (!enrichedSettings) {
      enrichedSettings = {}
      propsChanged = true
    }
    Object.keys(enrichedProps).forEach(key => {
      if (!propsAreSame(enrichedProps[key], enrichedSettings[key])) {
        propsChanged = true
        enrichedSettings[key] = enrichedProps[key]
      }
    })

    // Update the hash if we're in the builder so we can fully remount this
    // component
    if (get(builderStore).inBuilder && propsChanged) {
      propsHash = hashString(JSON.stringify(enrichedSettings))
    }
  }

  const evaluateConditions = conditions => {
    if (!conditions?.length) {
      return
    }

    // Default visible to false if there is a show condition
    let nextVisible = !conditions.find(condition => condition.action === "show")

    // Execute conditions and determine settings and visibility changes
    const activeConditions = getActiveConditions(conditions)
    const result = reduceConditionActions(activeConditions)
    if (result.visible != null) {
      nextVisible = result.visible
    }

    // Update state from condition results
    conditionalSettings = result.settingUpdates
    visible = nextVisible
  }

  // Drag and drop helper tags
  $: draggable = interactive && !isLayout && !isScreen
  $: droppable = interactive && !isLayout && !isScreen
</script>

{#key renderKey}
  {#if constructor && componentSettings && (visible || inSelectedPath)}
    <!-- The ID is used as a class because getElementsByClassName is O(1) -->
    <!-- and the performance matters for the selection indicators -->
    <div
      class={`component ${id}`}
      class:draggable
      class:droppable
      class:empty
      class:interactive
      data-id={id}
      data-name={name}
    >
      <svelte:component this={constructor} {...componentSettings}>
        {#if children.length}
          {#each children as child (child._id)}
            <svelte:self instance={child} />
          {/each}
        {:else if emptyState}
          <Placeholder />
        {/if}
      </svelte:component>
    </div>
  {/if}
{/key}

<style>
  .component {
    display: contents;
  }
  .interactive :global(*:hover) {
    cursor: pointer;
  }
  .draggable :global(*:hover) {
    cursor: grab;
  }
</style>
