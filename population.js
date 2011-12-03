var Population = function(populationSize, random) {
  if(random === undefined) {
    random = new Random();
  }

  var populationCount = 0;
  var totalIterations = 0;

  var gene_pool      = {};
  var total_profile_count = 0;

  var GENE_SIZE = 7;
  var geneCounts = new Array(GENE_SIZE);
  for(var i=0; i<GENE_SIZE; i++) { geneCounts[i]=1; }

  var live_set = [];
  var links = [];
  var link_map = {};

  var sid_history = [0];

  var linkId = function(source, target) {
    if(source < target) {
      return source + "-" + target;
    } else {
      return target + "-" + source;
    }
  }

  var Individual = function(gene, parent) {
    var obj = {};
    var id = ++populationCount;

    var key = gene.toString();

    var gene_info = gene_pool[key];
    if(gene_pool[key] === undefined) {
      total_profile_count++;
      gene_info = gene_pool[key] = {
          key: key,
          gene: gene,
          count: 0,
          id: total_profile_count,
          parent: parent,
          toString: function() { return this.id + " (#" + this.count + "): " + this.key; }
        };
      if(parent !== undefined) {
        parent_node = gene_pool[parent.dp];
        var new_angle = random.nextFloat() * Math.PI * 2;
        var new_dist = 10 + random.nextFloat() * 30;
        gene_info.x = (parent_node.x || 0) + new_dist * Math.cos(new_angle);
        gene_info.y = (parent_node.y || 0) + new_dist * Math.sin(new_angle);
      }
    } else {
      if(parent !== undefined) {
        if(gene_info.parent === undefined) {
          delete parent.dp;
          gene_info.parent = parent;
        } else {
          delete parent.dp;
          for(var k in parent) {
            gene_info.parent[k] = parent[k];
          }
        }
      }
    }
    if(++gene_info.count === 1) {
      live_set.push(gene_info);
      if(parent !== undefined) {
        delete parent.dp;
        for(var k in parent) {
          var id = linkId(gene_info.key, k);
          var link = link_map[id];

          if(link === undefined) {
            link = { source: gene_pool[k],
                     target: gene_info,
                     mutation: parent[k],
                     id: id,
                     value: 1 };
            link_map[id] = link;
            links.push(link);
          } else {
            console.log("Already known: " + link.id);
            link.value++;
            //alert("aaaaaaaaaaaaa")
          }
        }
      }
    }

    var mutatingClone = function(mutationProbability, recombinationProbability) {
      var newGene = gene.slice(0); // Clone
      var parent = {};
      parent.dp = key;
      parent[key] = true;
      for(var i=0; i<GENE_SIZE; i++) {
        var god = random.nextFloat();
        if(god < mutationProbability) {
          newGene[i] = ++geneCounts[i];
        } else if(god < mutationProbability + recombinationProbability) {
          var source_profile = random.nextIntCapped(live_set.length);
          newGene[i] = live_set[source_profile].gene[i];
          parent[live_set[source_profile].key] = false;
        } else {
          newGene[i] = newGene[i];
        }
      }
      return new Individual(newGene, parent);
    }

    var kill = function() {
      if(--gene_info.count === 0) {
        // TODO Optimize this (if at all possible)
        for(var i=0; i<live_set.length; i++) {
          if(live_set[i].id === gene_info.id) {
            live_set.splice(i, 1);
            break;
          }
        }

        for(var i=links.length-1; i>=0; i--) {
          if(links[i].source === gene_info || links[i].target === gene_info) {
            delete link_map[links[i].id];
            links.splice(i, 1);
          }
        }
      }
    }

    obj.key           = function() { return key; }
    obj.id            = function() { return gene_info.id; };
    obj.mutatingClone = mutatingClone,
    obj.kill          = kill;
    obj.parent        = function() { return parent; };
    obj.toString      = function() {
        return "{Individual: #" + id + ", gene=[" + gene.toString() + "]}";
      };

    return obj;
  };

  var initial_gene = new Array(7);
  for(var i=0; i<GENE_SIZE; i++) { initial_gene[i]=1; }

  var population = new Array(populationSize);
  for(var i=0; i<populationSize; i++) { population[i] = new Individual(initial_gene); }

  var sid;

  var generationStep = function(mutationProbability, recombinationProbability, sidHistoryCycle) {
    var killed  = random.nextIntCapped(populationSize);
    var doubled = random.nextIntCapped(populationSize - 1);
    if(doubled >= killed) { doubled++; }

    //console.log("Killed: " + killed + " - Doubled: " + doubled);

    population.push(population[doubled].mutatingClone(mutationProbability, recombinationProbability));
    population.splice(killed, 1)[0].kill();

    totalIterations++;
    if(sidHistoryCycle !== undefined) {
      if(totalIterations % sidHistoryCycle == 0) {
        sid_history.push(sid());
      }
    }
  };

  var graph = function() {
    return { nodes: live_set, links: links };
  };

  sid = function() {
    var S = live_set.length;
    var N = populationSize;
    var NN1 = N * (N-1);
    var SID, s = 0;
    for(var i=0; i<S; i++) {
      var ni = live_set[i].count;
      s += ni * (ni - 1)
    }
    return 1.0 - s * 1.0 / NN1;
  }

  var stats = function() {
    // http://darwin.phyloviz.net/ComparingPartitions/index.php?link=Tut4

    var S = live_set.length;
    var N = populationSize;
    var NN1 = N * (N-1);
    var SID = sid();

    var s1 = 0, s2 = 0;

    for(var i=0; i<S; i++) {
      var pi = live_set[i].count * 1.0 / N;
      var pi2 = pi * pi;

      s1 += pi2;
      s2 += pi2 * pi;
    }

    var varSID = (4.0*N*(N-1)*(N-2)*s2 + 2.0*N*(N-1)*s1 + 2.0*N*(N-1)*(2*N-3)*s1*s1) / (NN1 * NN1);
    var _2svarSID = 2*Math.sqrt(varSID);
    var CI95 = [SID - _2svarSID, SID + _2svarSID];

    return { SID: SID, varSID: varSID, CI95: CI95, totalIterations: totalIterations };
  };

  var toCountsString = function() {
    var counts = [];
    for (var seq in gene_pool) {
      var gene_info = gene_pool[seq];
      counts.push(gene_info);
    }

    var result = counts.sort(function(a, b) {
      return b.count - a.count;
    });

    result = counts.reduce(function(buffer, profile) {
      if(profile.count !== 0) {
        //return buffer + profile.id + " (#" + profile.count + "): " + profile.key + "\n";
        return buffer + profile + "\n";
      } else {
        return buffer;
      }
    }, "");

    return result;
  }

  var toString = function() {
    var result = "";
    for(var i=0; i<populationSize; i++) {
      result += population[i].toString() + "\n";
    }
    return result;
  }

  return {
    size: function() { return populationSize; },
    totalIterations: function() { return totalIterations; },
    sidHistory: function() { return sid_history; },
    generationStep: generationStep,
    graph: graph,
    toString: toString,
    toCountsString: toCountsString,
    stats: stats
  };
};

// var population = new Population(1000);
// 
// console.log(population.toString());
// 
// for(var i=0; i<1000; i++) {
//   population.generationStep(0.2);
// //  console.log(population.toString());
// }
// 
// console.log(population.toString());
