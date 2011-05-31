/**
 * Constructs a new, empty hg graph layout. Layouts are not typically constructed
 * directly; instead, they are added to an existing panel via
 * {@link pv.Mark#add}.
 *
 * <p>For more details on how to use this layout, see
 * {@link pv.Layout.HgGraph}.
 *
 * @extends pv.Layout.Network
 */
pv.Layout.HgGraph = function() {
  pv.Layout.Network.call(this);
  var that = this;
  this.link = new pv.Mark()
      .extend(this.node)
      .data(function(p) {
        var sn=p.sourceNode, tn=p.targetNode,
        dx = tn.x-sn.x, dy = tn.y-sn.y,
        midNode = {x:(sn.x+tn.x)/2-dy/8,y:(sn.y+tn.y)/2-dx/8};
        return [p.sourceNode, midNode, p.targetNode];
      })
      .fillStyle(null)
      .interpolate('basis')
      .lineWidth(function(d, p) { return p.linkValue * 1.5; })
      .strokeStyle("rgba(0,0,0,.2)");

  this.link.add = function(type) {
    return that.add(pv.Panel)
        .data(function() { return that.links(); })
      .add(type)
        .extend(this);
  };
};

pv.Layout.HgGraph.prototype = pv.extend(pv.Layout.Network)
  .property('repositories')
  .property('focus');

/**
 * Default properties for mercurial graph layouts.
 *
 * @type pv.Layout.HgGraph
 */
//pv.Layout.HgGraph.prototype.defaults = new pv.Layout.HgGraph()
//    .extend(pv.Layout.Network.prototype.defaults)

/** @private */
pv.Layout.HgGraph.prototype.buildImplied = function(s) {
  if (!s.links) s.links = pv.Layout.HgGraph.links.call(this);
  pv.Layout.Network.prototype.buildImplied.call(this, s);
};

pv.Layout.HgGraph.links = function() {
  var lnks = [], focus = this.focus();
  this.nodes()
    .filter(function(n) { return n.parents && n.parents.length; })
    .map(function(n) {
      pv.map(n.parents, function(p){
        lnks.push({
          source: n.index,
          target: p,
          linkValue: (n.index==focus || p==focus)?2:1
        });
      });
    });
  return lnks;
};

pv.Layout.HgGraph.prototype.search_revision = function(revsub) {
  return this.nodes()
    .filter(function(n) {
      return n.nodeValue.indexOf(revsub) == 0;
    });
};

pv.Layout.HgGraph.prototype.nodes_from_hg = function(hgdata) {
  var heads = hgdata.roots, nds=[], repos={}, repo_length=0;
  var touched = {};
  while (heads.length) {
    var pcnt = 0, newheads=[], repomap={};
    pv.map(heads, function(id) {
      if (id in touched) return;
      if (id in hgdata.parents) {
        if (hgdata.parents[id].filter(function(pid) {
          var parentNodeCreated = pid in touched;
          return !parentNodeCreated;
        }).length) {
          // we don't have all parents of this node yet, table
          newheads.push(id);
          return;
        }
      }
      var x = 20 * (nds.length+1);
      var y = 20 * (++pcnt);
      touched[id] = nds.length;
      var repo = hgdata.repositories[hgdata.pushes[hgdata.pushes4change[id][0]].repository];
      if (!(repo in repos)) repos[repo] = ++repo_length;
      var cs = hgdata.changesets[id];
      var node = {
        nodeValue: cs.revision.substr(0,12),
        description: cs.description,
        user: cs.user,
        repo: repo,
        branch: hgdata.branches[cs.branch_id],
        x: x,
        y: y
      };
      if (id in hgdata.parents) {
        node.parents = hgdata.parents[id];
      }
      if (id in hgdata.children) {
        node.children = hgdata.children[id];
        newheads = newheads.concat(node.children);
      }
      nds.push(node);
    });
    heads = newheads;
  }
  pv.map(nds, function(nd) {
    if (!('parents' in nd)) return;
    var prntids = [];
    for (var i=0,ii=nd.parents.length;i<ii;++i) {
      if (nd.parents[i] in touched) {prntids.push(touched[nd.parents[i]]);};
    }
    nd.parents = prntids;
  });
  this.nodes(nds);
  repos = pv.keys(repos);
  repos.sort();
  this.repositories(repos);
};
