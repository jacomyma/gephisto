Vue.use(Buefy)

var Graph = graphology
var GraphologyLibrary = graphologyLibrary

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
  			try {
	  			let reader = new FileReader();
	  			let parser = new DOMParser();
	  			reader.onload = () => {
	  				var doc = parser.parseFromString(reader.result, "text/xml");

		  			// Try parsing GEXF
		  			app._g = (() => {
		  				try {
							  let g = GraphologyLibrary.gexf.parse(Graph, doc);
							  // We need to invert y since the convention is different
							  g.nodes().forEach(nid=>{
							    let n = g.getNodeAttributes(nid);
							    n.y = -n.y;
							  });
							} catch(e) {
	      				console.error(e)
								g = undefined
								app.file = undefined
								alert("/!\\ Arg, something is wrong with this file...")
							}
						  return g;
						})();

	  			};
	        reader.readAsText(f);
	      } catch(e) {
	      	app.file = undefined
	      	alert("/!\\ Oops, there is a problem...")
	      	console.error(e)
	      }
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


