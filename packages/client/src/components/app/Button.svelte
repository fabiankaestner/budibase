<script>
  import { getContext } from "svelte"
  import "@spectrum-css/button/dist/index-vars.css"

  const { styleable } = getContext("sdk")
  const component = getContext("component")

  export let disabled = false
  export let text = ""
  export let onClick
  export let size = "M"
  export let type = "primary"
  export let quiet = false
</script>

<button
  class={`spectrum-Button spectrum-Button--size${size} spectrum-Button--${type}`}
  class:spectrum-Button--quiet={quiet}
  disabled={disabled || false}
  use:styleable={$component.styles}
  on:click={onClick}
>
  {text || ""}
</button>

<style>
  button {
    width: fit-content;
    width: -moz-fit-content;
  }
  .spectrum-Button--overBackground:hover {
    color: #555;
  }
  .spectrum-Button::after {
    display: none;
  }
</style>
