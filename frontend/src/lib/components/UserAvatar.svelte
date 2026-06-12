<script>
  export let user = null;        // { username, profile_image }
  export let size = 32;          // px
  export let radius = '50%';     // border-radius
  export let fontSize = null;    // override font size
</script>

<div
  class="ua-wrap"
  style="
    width:{size}px;
    height:{size}px;
    border-radius:{radius};
    font-size:{fontSize ?? Math.round(size * 0.42)}px;
  "
>
  {#if user?.profile_image}
    <img src={user.profile_image} alt={user?.username ?? ''} class="ua-img" />
  {:else}
    <span class="ua-initial">{(user?.username ?? '?').slice(0,1).toUpperCase()}</span>
  {/if}
</div>

<style>
  .ua-wrap {
    display: grid;
    place-items: center;
    overflow: hidden;
    background: linear-gradient(145deg,
      color-mix(in srgb, var(--accent) 18%, transparent),
      var(--bg-elevated)
    );
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
    flex-shrink: 0;
  }

  .ua-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ua-initial {
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
    letter-spacing: -0.02em;
    user-select: none;
  }
</style>
