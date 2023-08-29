<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
const Recommendations = defineAsyncComponent(() => import('./components/Recommendations.vue'))
</script>

<template>
  <h1>This is the green team</h1>
  <Recommendations item="fendt"/>
</template>

<style scoped>
</style>
