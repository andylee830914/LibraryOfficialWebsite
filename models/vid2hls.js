var isBuffer = require('isbuffer');
const { printTable } = require('console-table-printer');
var isempty = require('is-empty');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const PATH = require('path');
const dirTree = require('directory-tree');
const pretty = require('prettysize');
var fileExtension = require('file-extension');
var basename = require('basename');
const del = require('del');


class vid2hls {
    constructor(tempy, custom_video_id, custom_video_extension, callback) {
        this.tempy = tempy;
        this.custom_video_extension = custom_video_extension;
        this.fsLoc = this.tempy.file({ extension: custom_video_extension });
        this.fsDir = this.tempy.directory();
        this.custom_video_id = custom_video_id;
        fs.open(this.fsLoc, "wx", function (err1, fd) {
            // handle error
            if (err1) callback(`[ERROR] unable to create server-side temporary video file, at start-up @ ${err1}`);
            fs.close(fd, function (err2) {
                // handle error
                if (err2) { callback(`[ERROR] unable to create server-side temporary video file, at end-stage @ ${err2}`); } else {
                    callback(null);
                }
            });
        });
    }

    app_buff(buf, callback) {
        fs.appendFile(this.fsLoc, buf, function (err) {
            if (err) {
                callback('[ERROR] Data table header declared empty, the request is forbidden');
            }
            console.log("The file was saved!");
            callback(null);
        });
    }

    warehouse(idx, fileList, finish, warehousing, relay_this_warehouse,
        relay_this_fsLoc, relay_this_custom_video_extension, relay_this_custom_video_id) {
        console.log("🚀 ~ file: vid2hls.js ~ line 41 ~ vid2hls ~ warehouse ~ idx", idx)
        if (idx < fileList.children.length) {
            fs.readFile(fileList.children[idx].path, function (err, data) {
                if (err) {
                    throw err;//TODO EH
                }

                var toW = {
                    date_time: Date.now(),
                    file_name: fileList.children[idx].name,
                    file_extension: fileExtension(fileList.children[idx].name),
                    file_dir: fileList.name,
                    custom_video_title: basename(relay_this_fsLoc),
                    custom_video_info: relay_this_custom_video_extension,
                    custom_video_id: relay_this_custom_video_id
                    , support_resolution: ['TBD', 'TBD', 'TBD'],
                    file_size: Buffer.byteLength(data)
                    , data: data, file_size_pretty: pretty(Buffer.byteLength(data))
                };
                console.log("🚀 ~ file: vid2hls.js ~ line 64 ~ vid2hls ~ toW", toW)
                warehousing(toW
                    , (tf) => {
                        if (tf) {
                            relay_this_warehouse(idx + 1, fileList, finish, warehousing, relay_this_warehouse,
                                relay_this_fsLoc, relay_this_custom_video_extension, relay_this_custom_video_id);
                        } else {
                            console.log("[ERROR] Custom data processing return value display error")//TODO EH
                        }
                    });
            });
        } else {
            del([fileList.children[idx - 1] ? fileList.children[idx - 1].name : '']).then(() => {
                finish(null);
            });
        }
    }

    multi_resolution_synthesis(warehousing, finish, relay_this_fsDir, relay_this_fsLoc, mrs_head_obj) { // do something when encoding is done 
        var FWD_fsDir = relay_this_fsDir;
        var relay_this_warehouse = mrs_head_obj.warehouse;
        var relay_this_custom_video_extension = mrs_head_obj.custom_video_extension;
        var relay_this_custom_video_id = mrs_head_obj.custom_video_id;
        fs.writeFile(`${FWD_fsDir}/index.m3u8`, '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=842x480\n480p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720\n720p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080\n1080p.m3u8', function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
            // Loop through all the files in the temp directory
            dirTree(FWD_fsDir, {
                extensions: /\.(ts|m3u8)$/
            }, () => {
                // Create a table
                //const dir_tree = [
                //    { dir_tree: 'MID~~' }];
                //print
                //printTable(dir_tree);

            }, (item, PATH, stats) => {
                console.log(item);
                relay_this_warehouse(0, item, finish, warehousing, relay_this_warehouse,
                    relay_this_fsLoc, relay_this_custom_video_extension, relay_this_custom_video_id);
            });

        })
    }

    ff360(p0, p1, p2, p3, relay_this_mrs, mrs_head_obj, callback) {
        ffmpeg(p3).addOptions([ //360
            '-profile:v main',
            "-vf scale='w=min(640,trunc((360*dar)/2+0.5)*2):h=min(360,trunc((640/dar)/2+0.5)*2)',pad='w=640:h=360:x=(ow-iw)/2:y=(oh-ih)/2',setsar='sar=1/1'",
            '-c:a aac',
            '-ar 48000',
            '-b:a 96k',
            '-c:v h264',
            '-crf 20',
            '-g 48',
            '-keyint_min 48',
            '-sc_threshold 0',
            '-b:v 800k',
            '-maxrate 856k',
            '-bufsize 1200k',
            '-hls_time 10',
            `-hls_segment_filename ${p0}/360p_%05d.ts`,
            '-hls_playlist_type vod',
            '-f hls'
        ]).output(p0 + '/360p.m3u8').on('error', function (err, stdout, stderr) {

            console.log("ffmpeg stdout:\n" + stdout);
            console.log("ffmpeg stderr:\n" + stderr);
        }).on('error', function (err, stdout, stderr) {

            console.log("ffmpeg stdout:\n" + stdout);
            console.log("ffmpeg stderr:\n" + stderr);
        }).on('end', () => {
            this.ff480(p0, p1, p2, p3, relay_this_mrs, mrs_head_obj, callback);
            console.log("ffmpeg360");
        }).run()
    }
    ff480(p0, p1, p2, p3, relay_this_mrs, mrs_head_obj, callback) {
        ffmpeg(p3).addOptions([ //480
            '-profile:v main',
            "-vf scale='w=min(842,trunc((480*dar)/2+0.5)*2):h=min(480,trunc((842/dar)/2+0.5)*2)',pad='w=842:h=480:x=(ow-iw)/2:y=(oh-ih)/2',setsar='sar=1/1'",//why on earth is 842???
            '-c:a aac',
            '-ar 48000',
            '-b:a 128k',
            '-c:v h264',
            '-crf 20',
            '-g 48',
            '-keyint_min 48',
            '-sc_threshold 0',
            '-b:v 1400k',//292
            '-maxrate 1498k',//273
            '-bufsize 2100k',//195
            '-hls_time 10',
            `-hls_segment_filename ${p0}/480p_%05d.ts`,
            '-hls_playlist_type vod',
            '-f hls'
        ]).output(p0 + '/480p.m3u8').on('error', function (err, stdout, stderr) {

            console.log("ffmpeg stdout:\n" + stdout);
            console.log("ffmpeg stderr:\n" + stderr);
        }).on('error', function (err, stdout, stderr) {

            console.log("ffmpeg stdout:\n" + stdout);
            console.log("ffmpeg stderr:\n" + stderr);
        }).on('end', () => {
            this.ff720(p0, p1, p2, p3, relay_this_mrs, mrs_head_obj, callback);
            console.log("ffmpeg480");
        }).run()
    }
    ff720(p0, p1, p2, p3, relay_this_mrs, mrs_head_obj, callback) {
        ffmpeg(p3).addOptions([ //720
            '-profile:v main',
            "-vf scale='w=min(1280,trunc((720*dar)/2+0.5)*2):h=min(720,trunc((1280/dar)/2+0.5)*2)',pad='w=1280:h=720:x=(ow-iw)/2:y=(oh-ih)/2',setsar='sar=1/1'",
            '-c:a aac',
            '-ar 48000',
            '-b:a 128k',
            '-c:v h264',
            '-crf 20',
            '-g 48',
            '-keyint_min 48',
            '-sc_threshold 0',
            '-b:v 2800k',//329.14
            '-maxrate 2996k',//307.61
            '-bufsize 4200k',//219.42
            '-hls_time 10',
            `-hls_segment_filename ${p0}/720p_%05d.ts`,
            '-hls_playlist_type vod',
            '-f hls'
        ]).output(p0 + '/720p.m3u8').on('error', function (err, stdout, stderr) {

            console.log("ffmpeg stdout:\n" + stdout);
            console.log("ffmpeg stderr:\n" + stderr);
        }).on('end', () => {
            this.ff1080(p0, p1, p2, p3, relay_this_mrs, mrs_head_obj, callback);
            console.log("ffmpeg720");
        }).run()
    }
    ff1080(p0, p1, p2, p3, mrs, mrs_head_obj, callback) {
        ffmpeg(p3).addOptions([ //1080
            //TODO其實我不知道1080的參數要怎麼設，scale 這個設定黨應該是對的
            '-profile:v main',
            "-vf scale='w=min(1920,trunc((1080*dar)/2+0.5)*2):h=min(1080,trunc((1920/dar)/2+0.5)*2)',pad='w=1920:h=1080:x=(ow-iw)/2:y=(oh-ih)/2',setsar='sar=1/1'",//https://www.mobile01.com/topicdetail.php?f=510&t=3782292
            '-c:a aac',
            '-ar 48000',
            '-b:a 128k',
            '-c:v h264',
            '-crf 18',
            '-g 48',
            '-keyint_min 48',
            '-sc_threshold 0',
            '-b:v 17500k',
            '-maxrate 18000k',//https://www.mobile01.com/topicdetail.php?f=510&t=4500233
            '-bufsize 25200',
            '-hls_time 7',
            `-hls_segment_filename ${p0}/1080p_%05d.ts`,
            '-hls_playlist_type vod',
            '-f hls'
        ]).output(p0 + '/1080p.m3u8').on('end', () => {
            console.log("ffmpeg1080");

            callback(p0, p1, p2, p3, mrs, mrs_head_obj);

        }).on('error', function (err, stdout, stderr) {

            console.log("ffmpeg stdout:\n" + stdout);
            console.log("ffmpeg stderr:\n" + stderr);
        }).run()
    }

    end_trans(pt1, pt2) {
        var relay_this_fsDir = this.fsDir;
        var relay_this_fsLoc = this.fsLoc;
        var relay_this_warehouse = this.warehouse;
        var relay_this_custom_video_extension = this.custom_video_extension;
        var relay_this_custom_video_id = this.custom_video_id;
        var mrs_head_obj = {
            warehouse: relay_this_warehouse,
            custom_video_extension: relay_this_custom_video_extension,
            custom_video_id: relay_this_custom_video_id
        }
        var relay_this_mrs = this.multi_resolution_synthesis;
        this.ff360(relay_this_fsDir, pt1, pt2, relay_this_fsLoc, relay_this_mrs, mrs_head_obj, (p0, p1, p2, p3, mrs, mrs_head_obj) => {
            mrs(p1, p2, p0, p3, mrs_head_obj);
            del([p3]).then(() => {//TODO wtf
                console.log('OK')    //TODO tell user that it is ok
            });
        });

    }
}

var v2h = module.exports = vid2hls;