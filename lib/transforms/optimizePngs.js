var childProcess = require('child_process'),
    _ = require('underscore'),
    passError = require('assetgraph/lib/util/passError'),
    seq = require('seq'),
    pipeImageThroughChildProcessAndBuffer = require('../util/pipeImageThroughChildProcessAndBuffer'),
    histogram;

try {
    histogram = require('histogram');
} catch (err) {}

module.exports = function (queryObj) {
    return function optimizePngs(assetGraph, cb) {
        if (!histogram) {
            assetGraph.emit('error', new Error('optimizePngs: histogram not available, skipping quantization of png images.'));
        }

        //TODO: Detect available system png optimization tools
        seq(assetGraph.findAssets(_.extend({type: 'Png'}, queryObj)))
            .parEach(function (pngAsset) {
                if (!histogram) {
                    return this();
                }

                histogram(pngAsset.rawSrc, function (err, data) {
                    if (err) {
                        assetGraph.emit('error', err);
                        return this();
                    }
                    if (data.colors.rgba < 256) {
                        pipeImageThroughChildProcessAndBuffer.pngquant(String(data.colors.rgba < 2 ? 2 : data.colors.rgba))(pngAsset.rawSrc, function (err, optimizedSrc) {
                            if (err) {
                                assetGraph.emit('error', err);
                                return this();
                            }
                            pngAsset.rawSrc = optimizedSrc;
                        }.bind(this));
                    }
                    this();
                }.bind(this));
            })
            .parEach(function (pngAsset) {
                pipeImageThroughChildProcessAndBuffer.pngcrush("-rem alla")(pngAsset.rawSrc, function (err, optimizedSrc) {
                    if (err) {
                        assetGraph.emit('error', err);
                        return this();
                    }
                    pngAsset.rawSrc = optimizedSrc;
                    this();
                }.bind(this));
            })
            .parEach(function (pngAsset) {
                pipeImageThroughChildProcessAndBuffer.optipng()(pngAsset.rawSrc, function (err, optimizedSrc) {
                    if (err) {
                        assetGraph.emit('error', err);
                        return this();
                    }
                    pngAsset.rawSrc = optimizedSrc;
                    this();
                }.bind(this));
            })
            .seq(function () {
                cb();
            })
            .catch(cb);
    };
};
