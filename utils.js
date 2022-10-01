/**
 * @description 同步获取系统信息
 * @returns { any }
 */
export const getSystemInfoSync = () => uni.getSystemInfoSync();

/**
 * @description 获取设备像素大小
 * @returns { number }
 */
export const getDeviceWidth = function () {
  //之所以要区分PC版，是因为旧逻辑一直是用screenWidth，但PC版的screenWidth比windowWidth大得多。直接改又怕影响现有功能，所以做个兼容
  let sysInfo = getSystemInfoSync();

  if ((sysInfo["platform"] || "").includes("windows")) {
    return sysInfo.windowWidth || 0;
  } else {
    return sysInfo.screenWidth || 0;
  }
};

/**
 * @description 比较当前版本库版本
 * @param {string} [v1='']
 * @param {string} [v2='']
 * @return {*}
 */
export function compareVersion(v1 = "", v2 = "") {
  v1 = v1.split(".");
  v2 = v2.split(".");
  let len = Math.max(v1.length, v2.length);

  while (v1.length < len) {
    v1.push("0");
  }

  while (v2.length < len) {
    v2.push("0");
  }

  for (let i = 0; i < len; i++) {
    let num1 = parseInt(v1[i]);
    let num2 = parseInt(v2[i]);

    if (num1 > num2) {
      return 1;
    } else if (num1 < num2) {
      return -1;
    }
  }

  return 0;
}
