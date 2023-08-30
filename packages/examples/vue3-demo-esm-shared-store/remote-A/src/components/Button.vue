<template>
  <div style="border: 1px solid #4CAF50">
    Remote-A
    <br>
    <div>
      count: {{ counter.count }}
    </div>
    <div>
      <button id="remoteA" @click=counter.increase()>increase</button>
    </div>
  </div>
</template>

<script>
import counterState from 'myStore'

export default {
  setup() {
    let counter = counterState();
    return {counter};
  }
}
</script>