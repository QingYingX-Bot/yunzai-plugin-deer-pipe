import sharp from 'sharp';
import fs from 'fs';
import { CHECK_IMG, WRONG_IMG, DEERPIPE_IMG } from '../constants/core.js';

// 缓存静态图片资源，避免重复读取磁盘
const deerpipeBufferCached = fs.readFileSync(DEERPIPE_IMG);
const checkBufferCached = fs.readFileSync(CHECK_IMG);
const wrongBufferCached = fs.readFileSync(WRONG_IMG);

function getMonthCalendar(now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfMonth = new Date(year, month, 1).getDay();
    firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // 周一为起始

    const cal = [];
    let week = new Array(7).fill(null);
    let day = 1;

    // 填充第一周
    for (let i = firstDayOfMonth; i < 7; i++) {
        week[i] = day++;
    }
    cal.push(week);

    // 填充剩余周
    while (day <= daysInMonth) {
        week = new Array(7).fill(null);
        for (let i = 0; i < 7 && day <= daysInMonth; i++) {
            week[i] = day++;
        }
        cal.push(week);
    }

    return cal;
}


/**
 * 生成签到图片
 * 源代码来自：https://github.com/SamuNatsu/nonebot-plugin-deer-pipe/blob/main/src/nonebot_plugin_deer_pipe/image.py
 * @param now
 * @param name
 * @param deer
 * @param status
 * @returns {Promise<*>}
 */
export async function generateImage(now, name, deer, status = null) {
    const cal = getMonthCalendar(now);

    const IMG_W = 700;
    const BOX_W = 100;
    const BOX_H = 100;
    const IMG_H = BOX_H * (cal.length + 1);

    const compositeArray = [{
        input: {
            create: {
                width: IMG_W,
                height: IMG_H,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        }
    }];

    // 遍历日历，构建 composite 数组
    for (let weekIdx = 0; weekIdx < cal.length; weekIdx++) {
        for (let dayIdx = 0; dayIdx < cal[weekIdx].length; dayIdx++) {
            const day = cal[weekIdx][dayIdx];
            const x0 = dayIdx * BOX_W;
            const y0 = (weekIdx + 1) * BOX_H;
            if (day !== null) {
                // 底图
                compositeArray.push({
                    input: deerpipeBufferCached,
                    top: y0,
                    left: x0
                });

                // 日期数字
                compositeArray.push({
                    input: Buffer.from(
                        `<svg width="${BOX_W}" height="${BOX_H}">
                            <text x="5" y="${BOX_H - 35}" font-size="30" font-family="MiSans" fill="black">${day}</text>
                        </svg>`
                    ),
                    top: y0,
                    left: x0
                });

                // 同日鹿/戒鹿合并展示
                const deerCount = Number(deer[day] || 0);
                const withdrawalCount = Number(deer[`w_${day}`] || 0);

                if (deerCount > 0 || withdrawalCount > 0) {
                    compositeArray.push({
                        input: deerCount > 0 ? checkBufferCached : wrongBufferCached,
                        top: y0,
                        left: x0
                    });

                    // 鹿次数（右下，红色）
                    if (deerCount > 1) {
                        const txt = deerCount > 99 ? 'x99+' : `x${deerCount}`;
                        compositeArray.push({
                            input: Buffer.from(
                                `<svg width="${BOX_W}" height="${BOX_H}">
                                    <text x="${BOX_W - 5}" y="${BOX_H - 20}" font-size="30" font-family="MiSans" fill="red" text-anchor="end" font-weight="bold">${txt}</text>
                                </svg>`
                            ),
                            top: y0,
                            left: x0
                        });
                    }

                    // 戒鹿次数（左上，蓝色）
                    if (withdrawalCount > 0) {
                        const wTxt = withdrawalCount > 99 ? 'x99+' : `x${withdrawalCount}`;
                        compositeArray.push({
                            input: Buffer.from(
                                `<svg width="${BOX_W}" height="${BOX_H}">
                                    <text x="5" y="25" font-size="22" font-family="MiSans" fill="#1e90ff" text-anchor="start" font-weight="bold">${wTxt}</text>
                                </svg>`
                            ),
                            top: y0,
                            left: x0
                        });
                    }
                }
            }
        }
    }

    // 添加标题、用户名和状态信息
    const titleText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')} 签到${status !== null ? ` | 状态: ${status}` : ''}`;
    const nameText = name + (status && (status === "无力" || status === "疲惫") ? " ⚠️" : "");
    
    compositeArray.push({
        input: Buffer.from(
            `<svg width="${IMG_W}" height="${BOX_H}">
                <text x="5" y="35" font-size="30" font-family="MiSans" fill="black">${titleText}</text>
                <text x="5" y="85" font-size="30" font-family="MiSans" fill="black">${nameText}</text>
            </svg>`
        ),
        top: 0,
        left: 0
    });

    const imgBuffer = await sharp({
        create: {
            width: IMG_W,
            height: IMG_H,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    })
        .composite(compositeArray)
        .png()
        .toBuffer();

    return imgBuffer;
}


