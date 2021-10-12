Vue.use(Buefy)

// Graphology stuff
var Graph = graphology
var GraphologyLibrary = graphologyLibrary
var fa2 = graphologyLayoutForceatlas2

// Vue app
var app = new Vue({
  el: '#app',
  data: {
		file: undefined,
		waitingModalActive: false,
		waitingState: false,
		renderedState: false
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
		  				let g
		  				try {
							  g = GraphologyLibrary.gexf.parse(Graph, doc);
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

  		// Auto accept (for debug)
  		app.acceptPact()
  	},
  	loadSample: f => {
  		fetch("data/"+f)
  			.then(response => response.blob())
  			.then(blob => {
			    app.file = new File([blob], f);
			    app.uploadFile(app.file)
			  })
  	},
  	acceptPact: () => {
  		app.waitingModalActive = true
  		app.waitingState = true
  		setTimeout(() => {
  			app.canvas = renderNetworkMap()
  			app.legend = mutable.legend
  			app.renderedState = true
  			setTimeout(() => {
  				app.canvas.style.width = "100%"
  				document.getElementById('renderingArea').innerHTML = ""
  				document.getElementById('renderingArea').appendChild(app.canvas)
  				app.waitingState = false
  				app.waitingModalActive = false
  			}, 200)
  		}, 100);
  	},
  	undo: () => {
  		app.renderedState = false
  	},
  	downloadCanvas: () => {
  		app.canvas.toBlob(function(blob) {
        saveAs(blob, "Gephisto Network Map.png");
      })
  	}
  }
})




/// FUNCTIONS
var mutable = {}

function renderNetworkMap() {
	randomize_settings()

	// We initialize renderer settings here
	// because we sometimes set them in this process
  let settings = {}

	// From Observable prototype
  mutable.legend = "";
  let g = app._g.copy()
  
  let diagnosis = diagnose(g)

  settings.draw_node_labels = true

  // Margins (it depends on some things)
  settings.margin_top    =  6 // in mm
  settings.margin_right  =  6 // in mm
  settings.margin_bottom = 12 // in mm
  settings.margin_left   =  6 // in mm
  if (mutable.display_clusters) {
	  settings.margin_top    = 24 // in mm
	  settings.margin_right  = 24 // in mm
	  settings.margin_bottom = 24 // in mm
	  settings.margin_left   = 24 // in mm
  }

  let all_nodes_have_sizes = true
  let all_nodes_have_coordinates = true
  let all_nodes_have_colors = true
  g.nodes().forEach(nid => {
    let n = g.getNodeAttributes(nid)
    if (n.size === undefined) {
      all_nodes_have_sizes = false
      n.size = 1
    }
    if (n.x === undefined || n.y === undefined) {
      all_nodes_have_coordinates = false
      n.x = Math.random()
      n.y = Math.random()
    }
    if (n.color === undefined) {
    	all_nodes_have_colors = false
    	n.color = "#999"
    }
  })
  
  // NODE SIZE AND POSITION
  var layout, gravity
  if (all_nodes_have_sizes && all_nodes_have_coordinates && mutable.use_original_scale) {
    // Everything's fine
    mutable.legend += "The node sizes and positions are from the original data. ";
  } else {
    // Do we keep node positions, assuming there are some?
    if (all_nodes_have_coordinates && mutable.keep_node_positions) {
      // Everything's fine
      mutable.legend += "The node coordinates are from the original data. ";
    } else {
      // PICK AND COMPUTE LAYOUT
      
      // Pick
      let roll = mutable.layout_type_slider * d3.sum(layouts, c => c.chance)
      layouts.some(c => {
        roll -= c.chance
        if (roll <= 0) {
          layout = c
          return true
        }
        return false
      })
      console.log("Layout: "+layout.id)
      mutable.legend += "The node coordinates are computed using the layout algorithm "+layout.name+". ";
      
      let iterationsRatio = 0.666 + 1.333 * mutable.layout_quality_but_slower_slider
      if (layout.id == "fa2" || layout.id == "linlog") {
        if (layout.id == "fa2") {
          gravity = 0.02 + 0.48 * Math.pow(mutable.layout_gravity_slider, 3)
        } else {
          gravity = 0.00002 + 0.00018 * Math.pow(mutable.layout_gravity_slider, 3)
        }
        mutable.legend += "The gravity was set to "+numFormat(gravity)+". ";
        
        // Randomize starting positions
        g.nodes().forEach(nid => {
          let n = g.getNodeAttributes(nid)
          n.x = Math.random()
          n.y = Math.random()
        })
        
        if (layout.id == "fa2") {
          let iterations = 0
          // Let's start with a first batch of iterations optimized: no slowdown, BarnesHut if necessary
          layout.layout(g, {
            gravity: gravity,
            slowDown: 1,
            barnesHut: g.order > 1000,
            adjustSizes: false,
            iterations: Math.floor(iterationsRatio * 300)
          })
          iterations += Math.floor(iterationsRatio * 300)

          // Now let's desactivate Barnes Hut and slow down a bit
          layout.layout(g, {
            gravity: gravity,
            slowDown: 2,
            barnesHut: g.order > 10000,
            adjustSizes: false,
            iterations:  Math.floor(iterationsRatio * ( 200 + ((g.order <= 5000)?(300):(0)) ))
          })
          iterations += Math.floor(iterationsRatio * ( 200 + ((g.order <= 5000)?(300):(0)) ))

          // Finalize with a higher slowdown
          layout.layout(g, {
            gravity: gravity,
            slowDown: 10,
            barnesHut: g.order > 50000,
            adjustSizes: false,
            iterations:  Math.floor(iterationsRatio * ( 200 + ((g.order <= 50000)?(300):(0)) ))
          })
          iterations += Math.floor(iterationsRatio * ( 200 + ((g.order <= 5000)?(300):(0)) ))

          mutable.legend += "For the layout, "+iterations+" iterations were computed, in three batches with different settings, to optimize the rendering. ";
        } else { // LinLog
          layout.layout(g, {
            gravity: gravity,
            slowDown: .1,
            barnesHut: g.order > 5000,
            adjustSizes: false,
            iterations:  Math.floor(iterationsRatio * 2000)
          })
          layout.layout(g, {
            gravity: gravity,
            slowDown: 1,
            barnesHut: false,
            adjustSizes: false,
            iterations:  Math.floor(iterationsRatio * 1000)
          })
          mutable.legend += "For the layout, "+Math.floor(iterationsRatio * 3000)+" iterations were computed, in two batches with different settings, to optimize the rendering. ";
        }
        
      } else if (layout.id == "random") {
        layout.layout(g, {});
      }
    }
    if (mutable.different_node_sizes) {
      // Make a list of possible choices
      let candidates = []
      // Some choices are always there, like the degree.
      candidates.push({type:'native', id:'degree', chance:.7})
      if (g.type == "directed" || g.type == "mixed") {
        candidates.push({type:'native', id:'inDegree', chance:.5})
        candidates.push({type:'native', id:'outDegree', chance:.5})
      }
      
      // Then, there might be node attributes we can use
      for (let att in diagnosis.nodeAttributes) {
        let attData = diagnosis.nodeAttributes[att]
        if (attData.type == "integer" || attData.type == "float") {
          if (attData.modalitiesInfo.distinct > 1) {
            let chance = 1
            if (attData.type == "integer") {
              // When integer, there is an ambiguity about whether or not
              // the attribute is ordinal. It may be categorical.
              // To reflect that, we act on chance:
              // The less distinct modalities, the less probable it is that
              // the attribute is ordinal. But it is always possible.
              // We modulate the chances with a minimum value of 10%.
              chance = .1 + .9 * Math.min(1, attData.modalitiesInfo.distinct / Math.sqrt(g.order))
            }
            candidates.push({type:'attribute', id:att, chance})
          }
        }
      }
      let pick
      let roll = mutable.node_size_attribute_slider * d3.sum(candidates, c => c.chance)
      candidates.some(c => {
        roll -= c.chance
        if (roll <= 0) {
          pick = c
          return true
        }
        return false
      })

      mutable.legend += "Node size depends on the attribute "+pick.id+". ";
      
      // Now let's determine a min and max size
      let min_x = d3.min(g.nodes(), nid => g.getNodeAttribute(nid, 'x'))
      let max_x = d3.max(g.nodes(), nid => g.getNodeAttribute(nid, 'x'))
      let min_y = d3.min(g.nodes(), nid => g.getNodeAttribute(nid, 'y'))
      let max_y = d3.max(g.nodes(), nid => g.getNodeAttribute(nid, 'y'))
      // Rationale for the min size:
      // if the network were occupying a maximal area in a 20cm x 20cm image at 300dpi (2362px),
      // then the minimal node radius should correspond to a punctiation dot
      // at a font size of 12pt, which is around 3 pixels.
      let min_size = 3 * Math.max(max_x-min_x, max_y-min_y) / 2362
      // ...but this just being a heuristic, we add some variability.
      min_size *= 0.666 + mutable.node_size_slider * 2.333
      // Rationale for the max size:
      // Assuming that the bigger nodes are no more than 10% of the nodes,
      // they should occupy no more than 15% of the overall space.
      let max_size = 0.5 * Math.sqrt(.15 * Math.pow(Math.max(max_x-min_x, max_y-min_y), 2)) / (.1 * g.order)
      // ...but this just being a heuristic, we add some variability.
      max_size *= 0.666 + (mutable.node_size_slider + 13 * Math.pow(mutable.node_size_spread_slider, 5)) * 0.666
      // We just want to keep it at least 2 times as big as min_size
      
      // IMPORTANT NOTE:
      // Here size is the radius. Since the visual variable is the area,
      // we will have to factor that in the scaling.
      
      if (pick.type == 'native') {
        let extent = d3.extent(g.nodes(), nid => g[pick.id](nid))
        g.nodes().forEach(nid => {
          let n = g.getNodeAttributes(nid)
          let value = (g[pick.id](nid) - extent[0]) / (extent[1] - extent[0]) || 0
          let area = min_size*min_size + value*(max_size*max_size - min_size*min_size)
          n.size = Math.sqrt(area)
        })
      } else {
        let extent = d3.extent(g.nodes(), nid => g.getNodeAttribute(nid, pick.id))
        g.nodes().forEach(nid => {
          let n = g.getNodeAttributes(nid)
          let value = (g.getNodeAttribute(nid, pick.id) - extent[0]) / (extent[1] - extent[0]) || 0
          let area = min_size*min_size + value*(max_size*max_size - min_size*min_size)
          n.size = Math.sqrt(area)
        })
      }
    } else {
      // SET UNITARY NODE SIZE
      // Heuristic to find the right node size. We want to:
      // * Minimize the overlap between nodes
      // * Keep some visibility
      let min_x = d3.min(g.nodes(), nid => g.getNodeAttribute(nid, 'x'))
      let max_x = d3.max(g.nodes(), nid => g.getNodeAttribute(nid, 'x'))
      let min_y = d3.min(g.nodes(), nid => g.getNodeAttribute(nid, 'y'))
      let max_y = d3.max(g.nodes(), nid => g.getNodeAttribute(nid, 'y'))
      // Rationale for the min size:
      // if the network were occupying a maximal area in a 20cm x 20cm image at 300dpi (2362px),
      // then the minimal node radius should correspond to a punctiation dot
      // at a font size of 12pt, which is around 3 pixels.
      let min_size = 3 * Math.max(max_x-min_x, max_y-min_y) / 2362
      // Rationale for the comfortable size:
      // Same idea, but using the size of the letter "o" (lower case)
      // at a font size of 18pt, which is 18px.
      let comf_size = 18 * Math.max(max_x-min_x, max_y-min_y) / 2362
      // Strategy: start with the comfortable size, and see if there are overlaps.
      // If there are too many, test a smaller size but not smaller than the min size.
      // Threshold: 0.1% to 30% of nodes overlapping allowed (depending on settings)
      let overlap_thershold = g.order * (0.001 + 0.2999 * Math.pow(mutable.node_size_slider, 3))
      let overlaps = 0
      let test_size = comf_size
      do {
        // Computing overlaps:
        // we bin nodes in a grid whose size is the test_size
        let grid = {}
        overlaps = 0
        g.nodes().forEach(nid => {
          let n = g.getNodeAttributes(nid)
          n._x_bin = Math.floor((n.x-min_x) / test_size)
          n._y_bin = Math.floor((n.y-min_y) / test_size)
          let row = grid[n._x_bin] || {}
          row[n._y_bin] = row[n._y_bin] || []
          row[n._y_bin].push(nid)
          grid[n._x_bin] = row
        })
        // For each node, we get from the grid candidates that could be close
        // and we test them for overlap
        g.nodes().forEach(nid => {
          let n = g.getNodeAttributes(nid)
          let neighbors = []
          for (let i=n._x_bin - 1; i <= n._x_bin+1; i++) {
            for (let j=n._y_bin - 1; j <= n._y_bin+1; j++) {
              if (grid[i] && grid[i][j]) {
                for (let k in grid[i][j]) {
                  let n2id = grid[i][j][k]
                  if (n2id != nid) {
                    neighbors.push(n2id)
                  }
                }
              }
            }
          }
          let overlap = neighbors.some(n2id => {
            let n2 = g.getNodeAttributes(n2id)
            let d = Math.sqrt(Math.pow(n2.x-n.x, 2) + Math.pow(n2.y-n.y, 2))
            return d<test_size
          })
          if (overlap) {
            overlaps++
          }
        })
        test_size *= 0.8
      } while (test_size>min_size && overlaps>overlap_thershold)

      g.nodes().forEach(nid => {
        let n = g.getNodeAttributes(nid)
        n.size = test_size
      })

      mutable.legend += "Node size is set to a constant. ";
    }
    
    // If a layout has been computed and the quality is high enough, we make
    // a last pass to prevent overlap
    if (layout && (layout.id == "fa2" || layout.id == "linlog") && mutable.layout_quality_but_slower_slider > 0.2) {
      g.nodes().forEach(nid => {
        let n = g.getNodeAttributes(nid)
        n.size = n.size * 2.1
      })
      layout.layout(g, {
        gravity: gravity,
        slowDown: 10,
        barnesHut: false,
        adjustSizes: true,
        iterations:  300
      })
      g.nodes().forEach(nid => {
        let n = g.getNodeAttributes(nid)
        n.size = n.size / 2.1
      })

      mutable.legend += "Nodes have been slightly moved to minimize overlaps and improve readability. ";
    }
  }

  // NODE COLORS (and clusters)
  // Default stuff
  settings.node_fill_color = "#999" // Default
  settings.node_color_from_clusters = false
  settings.node_clusters = {} // Default
  settings.draw_cluster_contours = false
  settings.draw_cluster_fills = false
	settings.draw_cluster_labels = false
  let palette = [
	  {color:"#5ba5b8", name:"blue"},
	  {color:"#e87fbb", name:"pink"},
	  {color:"#66b456", name:"green"},
	  {color:"#f6522b", name:"red"},
	  {color:"#f9aa26", name:"yellow"}
  ]
  let paletteDefault = {color:"#5e676e", name:"grey"}
  settings.node_clusters["default_color"] = paletteDefault.color
  settings.node_clusters["default_color_name"] = paletteDefault.name

  // If we use colors and/or clustering, then we need to seek attributes (precomputation)
  let candidates = [];
  if ( !(all_nodes_have_colors && mutable.use_original_node_color) || mutable.display_clusters) {
    // Make a list of possible choices
    for (let att in diagnosis.nodeAttributes) {
      let attData = diagnosis.nodeAttributes[att]
      if (attData.type == "integer" || attData.type == "string") {
        if (attData.modalitiesInfo.distinct > 1 && attData.modalitiesInfo.distinct<0.5*g.order && att.toLowerCase().indexOf('degree') < 0) {
          let chance = 1
          if (attData.type == "integer") {
            // When integer, there is an ambiguity about whether or not
            // the attribute is ordinal. It may be categorical.
            // To reflect that, we act on chance:
            // The more distinct modalities, the less probable it is that
            // the attribute is ordinal. But it is always possible.
            // We modulate the chances with a minimum value of 10%.
            chance = .1 + .9 * Math.max(0, 1 - (Math.max(0, attData.modalitiesInfo.distinct-5)/(0.5*g.order-5)))
          }
          candidates.push({type:'attribute', id:att, chance})
        }
      }
    }
  }
  // Node color: do we use original colors?
  if (all_nodes_have_colors && mutable.use_original_node_color) {
  	settings.node_color_original = true
  	mutable.legend += "The node colors are from the original data. ";
  } else {
  	settings.node_color_original = false

    // Do we use multiple colors, or just a single one?
  	if (mutable.different_node_colors && candidates.length > 0) {
	    let nodeColorPick
	    let roll = mutable.node_color_attribute_slider * d3.sum(candidates, c => c.chance)
	    candidates.some(c => {
	      roll -= c.chance
	      if (roll <= 0) {
	        nodeColorPick = c
	        return true
	      }
	      return false
	    })
	    mutable.legend += "Node color depends on the attribute "+nodeColorPick.id+": ";
	    
	    settings.node_clusters["attribute_id"] = nodeColorPick.id
	    settings.node_clusters["modalities"] = {}
	    // Sort modalities
	    let modalities = diagnosis.nodeAttributes[nodeColorPick.id].modalities
	    let sortedModalities = []
	    for (let m in modalities) {
	    	sortedModalities.push({m:m, count:modalities[m]})
	    }
	    sortedModalities.sort(function(a,b){
	    	return b.count-a.count
	    })
	    sortedModalities.forEach((m,i) => {
	    	if (i<5) {
	    		settings.node_clusters["modalities"][m.m] = {
	    			label: m.m,
	    			count: m.count,
	    			color: palette[i].color,
	    			color_name: palette[i].name,
	    		}
			    mutable.legend += "in "+palette[i].name+" is "+m.m+"; ";
	    	}
	    })
	    if (sortedModalities.length>5) {
		    mutable.legend += "and in "+paletteDefault.name+" are the other modalities. ";
	    } else {
		    mutable.legend += "and there are no other modalities. ";
	    }
	    settings.node_color_from_clusters = true
    } else {
    	settings.node_fill_color = "#171637"

      settings.node_clusters = {}

      mutable.legend += "All nodes are colored the same. ";
    }

    // Clusters
    // We do not display clusters if original node colors were used
    // (because we don't know how badly it could interfere)
    if (mutable.display_clusters && !mutable.use_original_node_color) {
    	// How we display clusters depends on whether or not nodes were colored
    	if (settings.node_clusters["attribute_id"]) {
    		// We display clusters for the attribute used for node colors
    		if (mutable.clusters_as_fills) {
    			// Fills with cluster labels
    			settings.draw_cluster_labels = true
    			settings.draw_cluster_fills = true
    			mutable.legend += "Gatherings of nodes with the same "+settings.node_clusters["attribute_id"]+" were highlighted by a colorfull shape corresponding to their modality. ";
    		} else {
    			// Contours only
	    		settings.draw_cluster_contours = true
    			mutable.legend += "Gatherings of nodes with the same "+settings.node_clusters["attribute_id"]+" were highlighted by a color contour corresponding to their modality. ";
    		}
    	} else if (candidates.length > 0){
    		// Pick a cluster attribute
    		let clusterPick
		    let roll = mutable.node_color_attribute_slider * d3.sum(candidates, c => c.chance)
		    candidates.some(c => {
		      roll -= c.chance
		      if (roll <= 0) {
		        clusterPick = c
		        return true
		      }
		      return false
		    })
		    mutable.legend += "The cluster shapes highlight gatherings of nodes with the same modality for the attribute "+clusterPick.id+": ";
		    
		    settings.node_clusters["attribute_id"] = clusterPick.id
		    settings.node_clusters["modalities"] = {}
		    // Sort modalities
		    let modalities = diagnosis.nodeAttributes[clusterPick.id].modalities
		    let sortedModalities = []
		    for (let m in modalities) {
		    	sortedModalities.push({m:m, count:modalities[m]})
		    }
		    sortedModalities.sort(function(a,b){
		    	return b.count-a.count
		    })
		    sortedModalities.forEach((m,i) => {
		    	if (i<5) {
		    		settings.node_clusters["modalities"][m.m] = {
		    			label: m.m,
		    			count: m.count,
		    			color: palette[i].color,
		    			color_name: palette[i].name,
		    		}
				    mutable.legend += "in "+palette[i].name+" is "+m.m+"; ";
		    	}
		    })
		    if (sortedModalities.length>5) {
			    mutable.legend += "and in "+paletteDefault.name+" are the other modalities. ";
		    } else {
			    mutable.legend += "and there are no other modalities. ";
		    }

		    if (mutable.clusters_as_fills) {
    			// Fills with cluster labels
    			settings.draw_cluster_labels = true
    			settings.draw_cluster_fills = true
	    		settings.draw_cluster_contours = true
    			// Note: here we do not show node labels, to focus on clusters.
	    		settings.draw_node_labels = false
    		} else {
    			// Contours
    			settings.draw_cluster_labels = true
	    		settings.draw_cluster_contours = true
    		}
    	}
    }



  	console.log("Diagnosis", diagnosis)
    
  }

  /// OTHER RENDERER SETTINGS
  
  // Image size and resolution
  settings.image_width = 200 // in mm. Default: 200mm (fits in a A4 page)
  settings.image_height = 200
  settings.output_dpi = 300 // Dots per inch.
  settings.rendering_dpi = 300 // Default: same as output_dpi. You can over- or under-render to tweak quality and speed.
  
  // Tiling:
  // Tiling allows to build images that would be otherwise too large.
  // You will have to assemble them by yourself.
  settings.tile_factor = 1 // Integer, default 1. Number of rows and columns of the grid of exported images.
  settings.tile_to_render = [0, 0] // Grid coordinates, as integers
  
  // Orientation & layout:
  settings.flip_x = false
  settings.flip_y = true
  settings.rotate = 0 // In degrees, clockwise
  // settings.margin_top    =  6 // in mm
  // settings.margin_right  =  6 // in mm
  // settings.margin_bottom = 12 // in mm
  // settings.margin_left   =  6 // in mm
  
  // Layers:
  // Decide which layers are drawn.
  // The settings for each layer are below.
  settings.draw_background = true
  settings.draw_network_shape_fill = false
  settings.draw_network_shape_contour = false
  // settings.draw_cluster_fills = false
  // settings.draw_cluster_contours = false
  // settings.draw_cluster_labels = false
  settings.draw_edges = true
  settings.draw_nodes = true
  // settings.draw_node_labels = true
  settings.draw_connected_closeness = mutable.draw_grid
  
  // Layer: Background
  settings.background_color = "#ffffff"
  
  // Layer: Connected-closeness
  settings.cc_text_color = "#171637"
  settings.cc_text_border_color = "#ffffff"
  settings.cc_font_size = 8 // in pt
  settings.cc_line_color = "#171637"
  settings.cc_grid_line_color = "#d5d3d7"
  settings.cc_info_margin_offset = 4.5 // In mm
  
  // Layer: Network shape
  //        (a potato for the whole network)
  // ...generic structure
  settings.network_shape_size = 2 // Range: more than 0, default to 1.
  settings.network_shape_smoothness = 15 // In mm (underlying blur)
  settings.network_shape_swelling = 0.95 // Range: 0.01 to 0.99 // Balanced: 0.5 // Acts on size
  // ...shape fill
  settings.network_shape_fill_alpha = 0.2 // Opacity // Range from 0 to 1
  settings.network_shape_fill_color = "#f4efec"
  // ...shape contour
  settings.network_shape_contour_thickness = 2 // Min: 1
  settings.network_shape_contour_alpha = 0.8 // Opacity // Range from 0 to 1
  settings.network_shape_contour_color = "#FFF"
  
  // Layer: Clusters
  //        (a potato per modality of target attribute)
  // ...generic structure
  settings.cluster_all_modalities = false // By default, we only use modalities specified in "node_clusters"
  settings.cluster_node_size_margin = 3 // In mm
  settings.cluster_shape_smoothness = 10 // In mm (underlying blur)
  settings.cluster_shape_size = 1 // Range: more than 0, default to 1.
  settings.cluster_shape_swelling = 0.75 // Range: 0.01 to 0.99 // Balanced: 0.5 // Acts on size
  // ...cluster fills
  settings.cluster_fill_alpha = 0.2 // Opacity // Range from 0 to 1
  settings.cluster_fill_color_by_modality = true // if false, use default color below
  settings.cluster_fill_color_default = "#8B8B8B"
  settings.cluster_fill_overlay = true // A different blending mode
  // ...cluster contours
  settings.cluster_contour_thickness = .6 // Range: 0 to 10 or more
  settings.cluster_contour_alpha = 1 // Opacity // Range from 0 to 1
  settings.cluster_contour_color_by_modality = true // if false, use default color below
  settings.cluster_contour_color_default = "#8B8B8B"
  // ...cluster labels
  settings.cluster_label_colored = true
  settings.cluster_label_font_min_size = 8 // In pt
  settings.cluster_label_font_max_size = 14 // In pt
  settings.cluster_label_font_thickness = .45 // In mm
  settings.cluster_label_border_thickness = 1.6 // In mm
  settings.cluster_label_inner_color = "#ffffff" // Note: here color is on the border
  
  // Layer: Edges
  settings.edge_alpha = 1 // Opacity // Range from 0 to 1
  settings.edge_curved = false
  settings.edge_high_quality = false // Halo around nodes // Time-consuming
  settings.edge_color = "#b6b8c4"
  
  // Layer: Nodes
  settings.adjust_voronoi_range = 100 // Factor // Larger node halo
  settings.node_size = 0.8 // Factor to adjust the nodes drawing size
  //settings.node_color_original = false // Use the original node color
  settings.node_stroke_color = "#171637"
  //settings.node_fill_color = "#171637"
  
  // Layer: Node labels
  settings.label_color = "#171637"
  settings.label_max_length = 42 // Number of characters before truncate. Infinity is a valid value.
  settings.label_font_family = "Raleway"
  settings.label_font_min_size = 6 // in pt
  settings.label_font_max_size = 12  // in pt
  settings.label_font_thickness = .15
  settings.label_border_thickness = .8 // in mm
  settings.label_spacing_offset = 1.5 // in mm (prevents label overlap)
  settings.label_border_color = settings.background_color
  
  // Advanced settings
  settings.voronoi_range = 4 // Halo size in mm
  settings.voronoi_resolution_max = 1 * Math.pow(10, 7) // in pixel. 10^7 still quick, 10^8 better quality 
  settings.heatmap_resolution_max = 1 * Math.pow(10, 5) // in pixel. 10^5 quick. 10^7 nice but super slow.
  settings.heatmap_spreading = 12 // in mm

  let renderer = newRenderer()
  let canvas = renderer.render(g, settings)
  return canvas

  function diagnose(g) {
    // Get a list of nodes attributes
    var nAttributes = {}
    var attr
    g.nodes().forEach(function(nid){
      var n = g.getNodeAttributes(nid)
      for (attr in n) {
        if (attr!="x" && attr!="y" && attr!="size" && attr!="color") {
          if (nAttributes[attr] === undefined) {
            nAttributes[attr] = {
              nodesCount: 1
            }
          } else {
            nAttributes[attr].nodesCount++
          }
        }
      }
    })

    // Look at the types of modalities
    for (attr in nAttributes) {
      var attData = nAttributes[attr]
      attData.types = {}
      g.nodes().forEach(function(nid){
        var t = getType(g.getNodeAttribute(nid, attr))
        attData.types[t] = (attData.types[t] || 0) + 1
      })
    }

    // Guess type of the attributes
    for (attr in nAttributes) {
      var types = nAttributes[attr].types
      if (types.string !== undefined) {
        nAttributes[attr].type = 'string'
      } else if (types.float !== undefined) {
        nAttributes[attr].type = 'float'
      } else if (types.integer !== undefined) {
        nAttributes[attr].type = 'integer'
      } else {
        nAttributes[attr].type = 'error'
      }
    }

    // Aggregate distribution of modalities
    for (attr in nAttributes) {
      nAttributes[attr].modalities = {}
    }
    g.nodes().forEach(function(nid){
      var n = g.getNodeAttributes(nid)
      for (attr in nAttributes) {
        nAttributes[attr].modalities[n[attr]] = (nAttributes[attr].modalities[n[attr]] || 0) + 1
      }
    })
    for (attr in nAttributes) {
      var stats = {}
      var modalitiesArray = Object.values(nAttributes[attr].modalities)
      stats.distinct = modalitiesArray.length
      stats.groupSizeMin = d3.min(modalitiesArray)
      stats.groupSizeMax = d3.max(modalitiesArray)
      stats.groupSizeMedian = d3.median(modalitiesArray)
      stats.groupSizeDeviation = d3.deviation(modalitiesArray)
      stats.groupSizeUnitary = modalitiesArray.filter(function(d){return d==1}).length
      stats.groupSizeAbove1Percent = modalitiesArray.filter(function(d){return d>=g.order*0.01}).length
      stats.groupSizeAbove10Percent = modalitiesArray.filter(function(d){return d>=g.order*0.1}).length
      nAttributes[attr].modalitiesInfo = stats
    }

    // Get a list of edges attributes
    var eAttributes = {}
    g.edges().forEach(function(eid){
      var e = g.getEdgeAttributes(eid)
      for (attr in e) {
        if (eAttributes[attr] === undefined) {
          eAttributes[attr] = {
            edgesCount: 1
          }
        } else {
          eAttributes[attr].edgesCount++
        }
      }
    })

    // Look at the types of values
    for (attr in eAttributes) {
      var attData = eAttributes[attr]
      attData.types = {}
      g.edges().forEach(function(eid){
        var t = getType(g.getEdgeAttribute(eid, attr))
        attData.types[t] = (attData.types[t] || 0) + 1
      })
    }

    // Guess type of the attributes
    for (attr in eAttributes) {
      var types = eAttributes[attr].types
      if (types.string !== undefined) {
        eAttributes[attr].type = 'string'
      } else if (types.float !== undefined) {
        eAttributes[attr].type = 'float'
      } else if (types.integer !== undefined) {
        eAttributes[attr].type = 'integer'
      } else {
        eAttributes[attr].type = 'error'
      }
    }

    // Aggregate distribution of modalities
    for (attr in eAttributes) {
      eAttributes[attr].modalities = {}
    }
    g.edges().forEach(function(eid){
      var e = g.getEdgeAttributes(eid)
      for (attr in eAttributes) {
        eAttributes[attr].modalities[e[attr]] = (eAttributes[attr].modalities[e[attr]] || 0) + 1
      }
    })
    for (attr in eAttributes) {
      var stats = {}
      var modalitiesArray = Object.values(eAttributes[attr].modalities)
      stats.distinct = modalitiesArray.length
      stats.groupSizeMin = d3.min(modalitiesArray)
      stats.groupSizeMax = d3.max(modalitiesArray)
      stats.groupSizeMedian = d3.median(modalitiesArray)
      stats.groupSizeDeviation = d3.deviation(modalitiesArray)
      stats.groupSizeUnitary = modalitiesArray.filter(function(d){return d==1}).length
      stats.groupSizeAbove1Percent = modalitiesArray.filter(function(d){return d>=g.order*0.01}).length
      stats.groupSizeAbove10Percent = modalitiesArray.filter(function(d){return d>=g.order*0.1}).length
      eAttributes[attr].modalitiesInfo = stats
    }

    return {
      nodeAttributes: nAttributes,
      edgeAttributes: eAttributes
    }
  }

  function getType(str){
    // Adapted from http://stackoverflow.com/questions/16775547/javascript-guess-data-type-from-string
    if(str === undefined) str = 'undefined';
    if (typeof str !== 'string') str = str.toString();
    var nan = isNaN(Number(str));
    var isfloat = /^\d*(\.|,)\d*$/;
    var commaFloat = /^(\d{0,3}(,)?)+\.\d*$/;
    var dotFloat = /^(\d{0,3}(\.)?)+,\d*$/;
    if (!nan){
        if (parseFloat(str) === parseInt(str)) return "integer";
        else return "float";
    }
    else if (isfloat.test(str) || commaFloat.test(str) || dotFloat.test(str)) return "float";
    else return "string";
  }
}

function computeConnectedCloseness(g, settings) {
	// Default settings
	settings = settings || {}
	settings.epsilon = settings.epsilon || 0.03; // 3%
	settings.grid_size = settings.grid_size || 10; // This is an optimization thing, it's not the graphical grid

	const pairs_of_nodes_sampled = sample_pairs_of_nodes();
	const connected_pairs = g.edges().map(eid => {
	  const n1 = g.getNodeAttributes(g.source(eid));
	  const n2 = g.getNodeAttributes(g.target(eid));
	  const d = Math.sqrt(Math.pow(n1.x-n2.x, 2)+Math.pow(n1.y-n2.y, 2));
	  return d;
	})

	// Grid search for C_max
	
	let range = [0, Math.max(d3.max(pairs_of_nodes_sampled), d3.max(connected_pairs))];

	let C_max = 0;
	let distances_index = {};
	let Delta, old_C_max, C, i, target_index, indicators_over_Delta;
	do {
		for(i=0; i<=settings.grid_size; i++){
			Delta = range[0] + (range[1]-range[0]) * i / settings.grid_size;
			if (distances_index[Delta] === undefined) {
			  distances_index[Delta] = computeIndicators(Delta, g, pairs_of_nodes_sampled, connected_pairs);
			}
		}
		old_C_max = C_max;
		C_max = 0;
		indicators_over_Delta = Object.values(distances_index);
		indicators_over_Delta.forEach((indicators, i) => {
			C = indicators.C;
			if (C > C_max) {
				C_max = C;
				target_index = i;
			}
		});

		range = [
			indicators_over_Delta[Math.max(0, target_index-1)].Delta,
			indicators_over_Delta[Math.min(indicators_over_Delta.length-1, target_index+1)].Delta
		]
  } while ( (C_max-old_C_max)/C_max >= settings.epsilon/10 )
	
  const Delta_max = find_Delta_max(indicators_over_Delta, settings.epsilon);

  const indicators_of_Delta_max = computeIndicators(Delta_max, g, pairs_of_nodes_sampled, connected_pairs);
  
  // Resistance to misinterpretation
  if (indicators_of_Delta_max.C < 0.1) {
    return {
      undefined,
      E_percent_of_Delta_max: undefined,
      p_percent_of_Delta_max: undefined,
      P_edge_of_Delta_max: undefined,
      C_max: indicators_of_Delta_max.C
    }
  } else {
    return {
      Delta_max,
      E_percent_of_Delta_max: indicators_of_Delta_max.E_percent,
      p_percent_of_Delta_max: indicators_of_Delta_max.p_percent,
      P_edge_of_Delta_max: indicators_of_Delta_max.P_edge,
      C_max: indicators_of_Delta_max.C
    }    
  }
  
  // Internal methods

  // Compute indicators given a distance Delta
	function computeIndicators(Delta, g, pairs_of_nodes_sampled, connected_pairs) {
	  const connected_pairs_below_Delta = connected_pairs.filter(d => d<=Delta);
	  const pairs_below_Delta = pairs_of_nodes_sampled.filter(d => d<=Delta);

	  // Count of edges shorter than Delta
    // note: actual count
	  const E = connected_pairs_below_Delta.length;

	  // Proportion of edges shorter than Delta
    // note: actual count
	  const E_percent = E / connected_pairs.length;

	  // Count of node pairs closer than Delta
    // note: sampling-dependent
	  const p = pairs_below_Delta.length;

	  // Proportion of node pairs closer than Delta
    // note: sampling-dependent, but it cancels out
	  const p_percent = p / pairs_of_nodes_sampled.length;

	  // Connected closeness
	  const C = E_percent - p_percent;

	  // Probability that, considering two nodes closer than Delta, they are connected
    // note: p is sampling-dependent, so we have to normalize it here.
    const possible_edges_per_pair = g.undirected ? 1 : 2;
	  const P_edge = E / (possible_edges_per_pair * p * (g.order * (g.order-1)) / pairs_of_nodes_sampled.length);

	  return {
	    Delta,
	    E_percent,
	    p_percent,
	    P_edge, // Note: P_edge is complentary information, not strictly necessary
	    C
	  };
	}

	function sample_pairs_of_nodes(){
	  if (g.order<2) return [];
	  let samples = [];
	  let node1, node2, n1, n2, d, c;
	  const samples_count = g.size; // We want as many samples as edges
	  if (samples_count<1) return [];
	  for (let i=0; i<samples_count; i++) {
	    node1 = g.nodes()[Math.floor(Math.random()*g.order)]
	    do {
	      node2 = g.nodes()[Math.floor(Math.random()*g.order)]
	    } while (node1 == node2)
	    n1 = g.getNodeAttributes(node1);
	    n2 = g.getNodeAttributes(node2);
	    d = Math.sqrt(Math.pow(n1.x-n2.x, 2)+Math.pow(n1.y-n2.y, 2));
	    samples.push(d);
	  }
	  return samples;
	}

	function find_Delta_max(indicators_over_Delta, epsilon) {
	  const C_max = d3.max(indicators_over_Delta, d => d.C);
	  const Delta_max = d3.min(
	      indicators_over_Delta.filter(d => (
	        d.C >= (1-epsilon) * C_max
	      )
	    ),
	    d => d.Delta
	  );
	  return Delta_max;
	}
}

var layouts = [
  {
    id:'fa2',
    name:'Force Atlas 2',
    chance: 1,
    description:'The Force Atlas 2 layout with strong gravity enabled, LinLog disabled.',
    layout: (g, settings)=>{
      // Apply Force Atlas 2
      fa2.assign(g, {iterations: settings.iterations, settings: {
        linLogMode: false,
        outboundAttractionDistribution: false,
        adjustSizes: settings.adjustSizes,
        edgeWeightInfluence: 0,
        scalingRatio: 10,
        strongGravityMode: true,
        gravity: settings.gravity,
        slowDown: settings.slowDown,
        barnesHutOptimize: settings.barnesHut,
        barnesHutTheta: 0.5
      }});
    }
  }, {
    id:'linlog',
    name:'Lin Log',
    chance: .666, // Because it is so slow...
    description:'The Force Atlas 2 layout with strong gravity enabled, LinLog enabled.',
    layout: (g, settings)=>{
      // Apply Force Atlas 2
      fa2.assign(g, {iterations: settings.iterations, settings: {
        linLogMode: true,
        outboundAttractionDistribution: false,
        adjustSizes: settings.adjustSizes,
        edgeWeightInfluence: 0,
        scalingRatio: 10,
        strongGravityMode: true,
        gravity: settings.gravity,
        slowDown: settings.slowDown,
        barnesHutOptimize: settings.barnesHut,
        barnesHutTheta: 0.5
      }});
    }
  }
]

function randomize_settings() {
	// Default, for testing
  mutable.draw_grid = false
  mutable.use_original_scale = true
  mutable.keep_node_positions = true
  mutable.different_node_sizes = false
  mutable.use_original_node_color = false
  mutable.different_node_colors = false
  mutable.display_clusters = true
  mutable.clusters_as_fills = true
  
  mutable.node_size_attribute_slider = 0
  mutable.node_size_slider = 0
  mutable.node_size_spread_slider = 0
  mutable.layout_type_slider = 0
  mutable.layout_gravity_slider = 0
  mutable.layout_quality_but_slower_slider = 0
  mutable.node_color_attribute_slider = 0

  return // Comment to use actual randomization
  
  mutable.draw_grid = Math.random() <= .5
  mutable.use_original_scale = Math.random() <= .25
  mutable.keep_node_positions = Math.random() <= 0.5
  mutable.different_node_sizes = Math.random() <= 0.85
  mutable.use_original_node_color = Math.random() <= .25
  mutable.different_node_colors = Math.random() <= 0.85
  mutable.display_clusters = Math.random() <= 0.25
  mutable.clusters_as_fills = Math.random() <= 0.5

  mutable.node_size_attribute_slider = Math.random()
  mutable.node_size_slider = Math.random()
  mutable.node_size_spread_slider = Math.random()
  mutable.layout_type_slider = Math.random()
  mutable.layout_gravity_slider = Math.random()
  mutable.layout_quality_but_slower_slider = Math.random()
  mutable.node_color_attribute_slider = Math.random()
}

function numFormat(n) {
	return (+n.toPrecision(3)).toExponential()
}