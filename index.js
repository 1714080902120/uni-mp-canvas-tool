import { compareVersion } from './utils.js';

import { getDeviceWidth } from './utils.js';

let fitBox = null;
let toFit = null;
/**
 * @description 一个简化版的canvas工具,提供绘制view、image、text、roundRect、clear、drawNodeList以及render等这几个方法。
 * @param { object } options
 * @returns { void }
 */
export class CanvasTool {
    constructor(options = {}) {
        this.options = options;
        this.state = 'ready';
        // 异步任务队列
        this.callBackStack = () => {};
    }

    /**
     * @description 创建ctx上下文
     * @param { string } canvasId
     * @param { VueInstace } vm
     * @param { number } designWidth
     * @returns { void }
     */
    init(canvasId, vm, designWidth = 750) {
        if (!canvasId || !vm) {
            throw new Error(
                'need canvasId and page/component instance when create an instance of CanvasTool!',
            );
        }
        return new Promise((resolve) => {
            const { SDKVersion, pixelRatio: dpr } = uni.getSystemInfoSync();
            const use2dCanvas = compareVersion(SDKVersion, '2.9.2') >= 0;
            const deviceWidth = getDeviceWidth();
            const scaleRate = getDeviceWidth() / designWidth;

            this.use2dCanvas = use2dCanvas;
            this.dpr = dpr;
            this.vm = vm;
            this.designWidth = designWidth;
            this.deviceWidth = deviceWidth;

            // 当前设备需要乘算的比例
            this.scaleRate = scaleRate;

            this.state = 'initing';

            if (use2dCanvas) {
                const query = vm.createSelectorQuery();
                query
                    .select(`#${canvasId}`)
                    .fields({ node: true, size: true })
                    .exec((res) => {
                        const canvas = res[0].node;
                        const ctx = canvas.getContext('2d');
                        const { width, height } = res[0] || {};
                        const dw = width * dpr;
                        const dh = height * dpr;
                        canvas.width = dw;
                        canvas.height = dh;
                        ctx.scale(dpr, dpr);
                        this.ctx = ctx;
                        this.canvas = canvas;
                        this.boundary = {
                            x: 0,
                            y: 0,
                            w: width,
                            h: height,
                            dw,
                            dh,
                        };

                        toFit = toFitWrapper(scaleRate);
                        fitBox = boxWrap();
                        this.state = 'ready';
                        console.log('canvas state is ready');
                        doCallback(this.callBackStack);
                        resolve();
                    });
            } else {
                this.ctx = uni.createCanvasContext(canvasId, vm);
                this.state = 'ready';
            }
        });
    }

    /**
     * @description 渲染一个圆角区间
     * @param { object } box
     * @property { number } x
     * @property { number } y
     * @property { number } w
     * @property { number } h
     * @property { number } r
     * @property { string } fillStyle
     * @property { string } strokeStyle
     * @returns { void }
     */
    roundRect(box) {
        if (this.state !== 'ready') {
            this.callBackStack = asyncWrap(this.callBackStack, () => {
                this.roundRect(box);
            });
            return;
        }
        let { x, y, w, h, r, fillStyle, strokeStyle } = box || {};
        if (!box || r < 0) {
            return;
        }
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
        ctx.arc(x + w - r, y + r, r, (Math.PI * 3) / 2, 0);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        ctx.lineTo(x, y + r);
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.stroke();
        }
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
    }

    /**
     * @description 渲染一个view
     * @param { object } box
     * @param { object } style
     * @returns { void }
     */
    drawView(box, style) {
        if (this.state !== 'ready') {
            this.callBackStack = asyncWrap(this.callBackStack, () => {
                this.drawView(box, style);
            });
            return;
        }
        const ctx = this.ctx;
        const { x, y, w, h } = fitBox(box) || {};
        let {
            borderRadius = 0,
            borderWidth = 0,
            borderColor,
            color = '#000',
            backgroundColor = 'transparent',
        } = style || {};
        ctx.save();
        // 外环
        borderRadius = toFit(borderRadius);
        if (borderWidth > 0) {
            borderWidth = toFit(borderWidth);
            this.roundRect({
                x,
                y,
                w,
                h,
                r: borderRadius,
                fillStyle: borderColor || color,
            });
        }

        // 内环
        const innerWidth = w - 2 * borderWidth;
        const innerHeight = h - 2 * borderWidth;
        const innerRadius =
            borderRadius - borderWidth >= 0 ? borderRadius - borderWidth : 0;
        this.roundRect({
            x: x + borderWidth,
            y: y + borderWidth,
            w: innerWidth,
            h: innerHeight,
            r: innerRadius,
            fillStyle: backgroundColor,
        });
        ctx.restore();
    }

    /**
     * @description 渲染一个image
     * @param { string } img
     * @param { object } box
     * @param { object } style
     * @returns { void }
     */
    async drawImage(img, box, style) {
        if (this.state !== 'ready') {
            this.callBackStack = asyncWrap(this.callBackStack, () => {
                this.drawImage(img, box, style);
            });
            return;
        }
        await new Promise((resolve, reject) => {
            const ctx = this.ctx;
            const canvas = this.canvas;

            let { borderRadius = 0 } = style || {};
            borderRadius = toFit(borderRadius);
            const { x, y, w, h } = fitBox(box) || {};
            ctx.save();
            this.roundRect({ x, y, w, h, r: borderRadius });
            ctx.clip();

            const _drawImage = (img) => {
                if (this.use2dCanvas) {
                    const Image = canvas.createImage();
                    Image.onload = () => {
                        ctx.drawImage(Image, x, y, w, h);
                        ctx.restore();
                        resolve();
                    };
                    Image.onerror = () => {
                        reject(new Error(`createImage fail: ${img}`));
                    };
                    Image.src = img;
                } else {
                    ctx.drawImage(img, x, y, w, h);
                    ctx.restore();
                    resolve();
                }
            };

            const isTempFile = /^wxfile:\/\//.test(img);
            const isNetworkFile = /^https?:\/\//.test(img);

            if (isTempFile) {
                _drawImage(img);
            } else if (isNetworkFile) {
                uni.downloadFile({
                    url: img,
                    success(res) {
                        console.log(
                            '🍂-----log-obj--down_load_img_success',
                            res,
                        );
                        if (res.statusCode === 200) {
                            _drawImage(res.tempFilePath);
                        } else {
                            reject(new Error(`downloadFile:fail ${img}`));
                        }
                    },
                    fail() {
                        reject(new Error(`downloadFile:fail ${img}`));
                    },
                });
            } else {
                reject(new Error(`image format error: ${img}`));
            }
        });
    }

    /**
     * @description 渲染一个image
     * @param { string } text
     * @param { object } box
     * @param { object } style
     * @returns { void }
     */
    drawText(text, box, style) {
        if (this.state !== 'ready') {
            this.callBackStack = asyncWrap(this.callBackStack, () => {
                this.drawText(text, box, style);
            });
            return;
        }
        const ctx = this.ctx;
        let { x, y, w, h } = fitBox(box) || {};
        let {
            color = '#000',
            lineHeight = '1.4em',
            fontSize = 14,
            textAlign = 'left',
            verticalAlign = 'top',
            backgroundColor = 'transparent',
            font = '',
        } = style || {};
        fontSize = toFit(fontSize);
        if (typeof lineHeight === 'string') {
            // 2em
            lineHeight = Math.ceil(
                parseFloat(lineHeight.replace('em')) * fontSize,
            );
        }

        // 如果宽度设置为0，那么这里就直接把宽度设置为文字长度
        if (!w) {
            w = ctx.measureText(text).width;
        }

        // console.log('🍂-----log-obj--text', {
        //   text,
        //   lineHeight,
        //   h,
        //   fontSize
        // });
        if (!text || lineHeight > h) {
            return;
        }

        ctx.save();
        ctx.textBaseline = 'top';
        if (font) {
            ctx.font = font;
        } else {
            ctx.font = `${fontSize}px sans-serif`;
        }
        ctx.textAlign = textAlign;

        // 背景色
        this.roundRect({ x, y, w, h, r: 0, fillStyle: backgroundColor });

        // 文字颜色
        ctx.fillStyle = color;

        // 水平布局
        switch (textAlign) {
            case 'left':
                break;
            case 'center':
                x += 0.5 * w;
                break;
            case 'right':
                x += w;
                break;
            default:
                break;
        }

        const textWidth = ctx.measureText(text).width;
        const actualHeight = Math.ceil(textWidth / w) * lineHeight;
        let paddingTop = Math.ceil((h - actualHeight) / 2);
        if (paddingTop < 0) {
            paddingTop = 0;
        }

        // 垂直布局
        switch (verticalAlign) {
            case 'top':
                break;
            case 'middle':
                y += paddingTop;
                break;
            case 'bottom':
                y += 2 * paddingTop;
                break;
            default:
                break;
        }

        const inlinePaddingTop = Math.ceil((lineHeight - fontSize) / 2);

        // 不超过一行
        if (textWidth <= w) {
            ctx.fillText(text, x, y + inlinePaddingTop);
            return;
        }

        // 多行文本
        const chars = text.split('');
        const baseY = y;

        // 用于判断行是否超出设定好的高度
        function isOverFlow(y) {
            return y + lineHeight >= baseY + h;
        }

        // 逐行绘制
        let line = '';
        // 记录下需要渲染的内容，然后再一起渲染
        const textRenderStack = [];

        for (const ch of chars) {
            const testLine = line + ch;
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > w) {
                let needBreak = false;
                if (isOverFlow(y)) {
                    // 打省略点
                    if (line.length > 2) {
                        line = `${line.substring(0, line.length - 2)}...`;
                    }
                    needBreak = true;
                }

                textRenderStack.push({
                    text: line,
                    x,
                    y: y + inlinePaddingTop,
                });

                if (needBreak) {
                    line = '';
                    break;
                }

                line = ch;
                y += lineHeight;
            } else {
                line = testLine;
            }
        }

        // 避免溢出
        if (line) {
            if (y + lineHeight > baseY + h) {
                if (textRenderStack.length > 0) {
                    const lastItem =
                        textRenderStack[textRenderStack.length - 1];
                    let text = lastItem.text;
                    // 打省略点
                    if (text.length > 2) {
                        text = `${text.substring(0, text.length - 2)}...`;
                    }
                    lastItem.text = text;
                }
            } else {
                textRenderStack.push({
                    text: line,
                    x,
                    y: y + inlinePaddingTop,
                });
            }
        }

        // 渲染多行text
        textRenderStack.forEach(({ text, x, y }) => ctx.fillText(text, x, y));

        ctx.restore();
    }

    /**
     * @description canvas生成临时本地图片路径...本来这块可以promise的优雅写法，但是因为getContext的该死异步
     * @param { { fileType: string; quality: number } } args
     * @returns { Promise<any> }
     */
    async canvasToTempFilePath(args = {}) {
        if (this.state !== 'ready') {
            this.callBackStack = asyncWrap(this.callBackStack, () => {
                setTimeout(() => {
                    this.canvasToTempFilePath(args);
                });
            });
            return;
        }

        return await new Promise((resolve, reject) => {
            const { fileType = 'png', quality = 1 } = args;
            const { y, x, w, h, dw, dh } = this.boundary || {};
            const use2dCanvas = this.use2dCanvas;
            const { canvasId } = this.options;
            const copyArgs = {
                x,
                y,
                width: w,
                height: h,
                destWidth: dw,
                destHeight: dh,
                canvasId,
                fileType: fileType,
                quality: quality,
                success: resolve,
                fail: reject,
            };

            if (use2dCanvas) {
                delete copyArgs.canvasId;
                copyArgs.canvas = this.canvas;
            }
            uni.canvasToTempFilePath(copyArgs, this.vm);
        });
    }

    /**
     * @description 多种类型，传一个数组,提供自定义渲染执行
     * @param { object } renderQueue
     * @returns { void }
     */
    async drawNodeList(renderQueue = []) {
        for (let i = 0; i < renderQueue.length; i++) {
            const {
                type = 'view',
                img = '',
                box = {},
                style = {},
                text = '',
                customFunc = () => {},
            } = renderQueue[i] || {};
            switch (type) {
                case 'view':
                    this.drawView(box, style);
                    break;
                case 'image':
                    // 由于图片自身有异步问题，所以这里异步了，可能会导致你最后想要的tempPath拿不到
                    await this.drawImage(img, box, style);
                    break;
                case 'text':
                    this.drawText(text, box, style);
                    break;
                case 'custom':
                    await customFunc(this);
                    break;
                default:
                    this.drawView(box, style);
            }
        }
    }

    /**
     * @description 合并多个步骤 1. init 2. drawNodeList 3. return tempPath, 但如果你有需要用到其它数据的，请确保时机拿到的数据是正确的。
     * @param { object } options
     * @returns { undefined | string }
     */
    async render(options = {}) {
        const {
            id,
            vm,
            renderQueue,
            tempFilePathArgs = {},
            designWidth = 750,
        } = options;
        try {
            await this.init(id, vm, designWidth);
            await this.drawNodeList(renderQueue);
            return this.canvasToTempFilePath(tempFilePathArgs);
        } catch (error) {
            throw new Error('something_went_wrong_when_render');
        }
    }

    /**
     * @description 清空区域
     * @param { object } box
     * @returns { void }
     */
    clear(box) {
        const { x, y, w, h } = box || this.boundary || {};

        this.ctx.clearRect(x, y, w, h);
    }

    /**
   * @description 如果你有其它需要，这里暴露出ctx，然你自己丰衣足食

   * @returns { CanvasContext2d }
  */
    getContext() {
        if (!this.ctx) {
            throw new Error('you need to init context before other !');
        }
        return this.ctx;
    }
}

function asyncWrap(curr, next) {
    return async () => {
        await curr();
        await next();
    };
}

async function doCallback(callback) {
    const func = await callback();
    if (func instanceof Function) {
        doCallback(func);
    }
}

function boxWrap() {
    return ({ x = 0, y = 0, w = 0, h = 0 }) => {
        return {
            x: toFit(x),
            y: toFit(y),
            w: toFit(w),
            h: toFit(h),
        };
    };
}

/**
 * @description 适应的宽高
 * @param { number } num
 * @returns { Function }
 */
export function toFitWrapper(num) {
    return (value) => value * num;
}