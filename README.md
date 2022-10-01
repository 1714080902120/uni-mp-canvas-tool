# 一个uniapp mp-weixin的canvas工具

## 前言
这是一个`uniapp`转`mp-weixin`的`canvas`工具
 * 由于`api`的异步问题，这里做了几次尝试，最开始`init`放构造函数，然后`function`是执行队列异步执行，但是很丑，代码先保留了，
 * 现在是把`init`暴露了出去，让开发者去注意生成实例后务必 `await instance.init(id, vm);`
 * 另外需要注意`drawimage`/带有`image`节点的`drawNodeList`的异步问题，如果你有需要拿到最后的tempPath并return 给别的方法,（比如是转发图片自定义这种）
 * 那你就得注意`drawImage`/带有`image`节点的`drawNodeList`的异步问题，推荐加个await 在前面。
 * 如果只是渲染，就不用在意。
 *
 * 或者你可以在生成实例后直接调用`render`方法，但如果你有需要用到其它数据，请确保获取的时机是正确的。
 *
 *
 * 这里提一下设备像素相关的，由于设计稿是根据`iphone678`的机型去设计的，然后一般给出的是`750rpx`宽，所以转换过来
 * 就是`375px`, `dpr`即像素比是`1:2`。但是在一些其他手机上就不是这个比例了，比如我的蛇皮小米8是`393px`的。。。
 *
 * 你的设计稿已`375`为倍速，如果你init传入的比例不是这个建议设计稿转成成比例的。这里默认是`750`
 *
 * `scaleRate`公式：(设计稿宽 / 375) / (设备宽 / 375) 即：设计稿宽 / 设备宽。
 *
 * 为什么要这样做？是为了让你开发的时候不用自己去换算，这个工具里大部分情况会帮你去算，
 * 所以开发直接传入设计稿给出的宽高即可。
 *
 * 不过关于文本的你需要多注意下，因为比例挺恶心不一定是整数

## api
- `init`: 调用官方`API`初始化`canvas`实例
    + `canvasId`: 你的`canvas dom`的`id`
    + `vm`: 你的`canvas dom`所在的组件/页面的`this`
    + `designWidth`: 你的设计稿宽度，这里默认750rpx，对标`iphone678`
- `roundRect`: 绘制区域，尽量不要单独调用这个方法，由于该方法较为底层，所以没有进行像素比适配，如果确实有必要自行调用，请引入`toFit`方法执行获取`scaleRate`
    + `box`: `{ w: width, h: height, x: startX, y: startY }`
- `drawView`: 绘制一个区域
    + `box`: 同上
    + `style`: `{ borderRadius = 0, borderWidth = 0, borderColor, color = '#000', backgroundColor = 'transparent' }`
- `drawImage`: 绘制图片，允许使用线上图片和本地图片。如果单独使用请记得加上`await`防止最终拿到的临时图片路径里没有绘制到图片
    + `box`: 同上
    + `style`: `{ borderRadius = 0 }`
- `drawText`: 绘制文本，会根据当前给出的`w`和`h`来判断是否需要换行，最后一行如果依旧超出则自动打点。由于拿到的像素比不一定是整数，所以文本宽高尽量给多些。
    + `box`: 同上
    + `style`: `{ color = '#000', lineHeight = '1.4em', fontSize = 14, textAlign = 'left', verticalAlign = 'top', backgroundColor = 'transparent' }`
- `canvasToTempFilePath`: 获取渲染区域的绘制内容图片路径
    + `args`: `{ fileType = 'png', quality = 1 }`
- `drawNodeList`: 根据内容绘制
    + `renderQueue`: 绘制的列表，其中每一项的`type`可为：`view、image、text、custom`, 其中`image`需要传入`img`图片链接，`text`需要传入`text`文本内容，而`custom`代表需要自定义渲染，需要传入`customFunc`回调，参数为实例对象。
- `render`：整合`init`、`drawNodeList`和`canvasToTempFilePath`三步，返回绘制内容临时路径。
    + `options`: `{ id, vm, renderQueue, tempFilePathArgs = {}, designWidth = 750, }`

## 例子
```javascript
import { CanvasTool } from 'uni-mp-canvas-tool';

const canvas = new CanvasTool({});

const renderQueue = [{
    type: 'view',
    box: { w: 750, h: 550, x: 0, y: 0 },
    style: {
        borderRadius: 16,
        backgroundColor: '#fff'
    }
},{
    type: 'image',
    img: 'https:xxx',
    box: { w: 740, h: 540, x: 10, y: 10 },
    style: { borderRadius: 10 }
}, {
    type: 'text',
    text: '123',
    box: { w: 740, h: 540, x: 10, y: 10 },
    style: {
        fontSize: 28
    }
}, {
    type: 'custom',
    customFunc: (canvas) => {
        const { ctx, scaleRate } = canvas;
        console.log(ctx, scaleRate)
    }
}]

return await canvas.render({
    id: 'canvas',
    vm: this,
    tempFilePathArgs: {},
    designWidth: 750,
})

```

## 最后
另外有问题请自行修改，本人没啥空维护，也不对任何损失问题负责