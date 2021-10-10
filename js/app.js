Vue.use(Buefy)

var app = new Vue({
  el: '#app',
  data: {
		file: false
  },
  methods: {
  	test: function(d){console.log("TEST", d)}
  }
})

