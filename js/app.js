Vue.use(Buefy)

var app = new Vue({
  el: '#app',
  data: {
		file: undefined,
		waitingState: false
  },
  methods: {
  	uploadFile: f => {
  		console.log("TEST", f)
  		if (f.name.split('.').pop().toLowerCase() == "gexf") {
  			console.log("Proceed")
  			app.waitingState = true
  		} else {
  			app.file = undefined
  			alert("/!\\ Only GEXF files are accepted.")
  		}
  	},
  	acceptPact: () => {
  		console.log("OK")
  	}
  }
})


