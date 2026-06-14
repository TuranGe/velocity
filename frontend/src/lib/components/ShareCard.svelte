<script>
  import Modal from './Modal.svelte';
  import RecapCard from './RecapCard.svelte';
  import { t } from '$lib/stores/i18n';

  export let show = false;
  export let username = 'User';
  export let initials = '?';
  export let profileImage = '';
  export let totalHours = '0.0';
  export let totalSessions = 0;
  export let doneTasks = 0;
  export let chartDays = []; // [{ label, minutes, isToday }]
  export let currentStreak = 0;
</script>

<Modal bind:show wide on:close={() => (show = false)}>
  <div class="share-modal-header">
    <h3>{$t('recap_card_title')}</h3>
  </div>

  <RecapCard
    {username}
    {initials}
    {profileImage}
    {totalHours}
    {totalSessions}
    {doneTasks}
    {chartDays}
    {currentStreak}
    filenameSuffix="stats"
  />
</Modal>

<style>
  .share-modal-header { margin-bottom: 0.75rem; }
  .share-modal-header h3 { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
</style>