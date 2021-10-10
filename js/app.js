Vue.use(Buefy)

var app = new Vue({
  el: '#app',
  data: {
		file: undefined,
		waitingModalActive: false,
		waitingState: false
  },
  methods: {
  	uploadFile: f => {
  		if (f.name.split('.').pop().toLowerCase() == "gexf") {
  			console.log("Proceed")
  		} else {
  			app.file = undefined
  			alert("/!\\ Only GEXF files are accepted.")
  		}
  	},
  	acceptPact: () => {
  		console.log("OK")
  		app.waitingModalActive = true
  		app.waitingState = true
  	}
  }
})


