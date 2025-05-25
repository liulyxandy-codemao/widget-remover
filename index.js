// @ts-check
import axios from 'axios';
import swal from 'sweetalert';

let remover_config = JSON.parse(window.localStorage.getItem("remover_config") || '{"fresh_before_remove":true}')
// 控件class名
const WIDGET_SECTION_CLASS = "WidgetList_widgetItem__14O1V"

/**
 * 保存配置
 */
function saveConfig() {
    window.localStorage.setItem("remover_config", JSON.stringify(remover_config))
}

/**
 * 上传文件
 * @thanks lizzzhh
 */
async function codemao_update_file(file, uuid) {
    let url = `https://open-service.codemao.cn/cdn/qi-niu/tokens/uploading?projectName=appcraft&filePaths=appcraft/WIDREMOVER_${uuid}.json&filePath=appcraft/WIDREMOVER_${uuid}.json&tokensCount=1&fileSign=p1&insertOnly=true&cdnName=qiniu`
    let token_res = await axios.get(url, { withCredentials: true })
    let token = token_res.data["tokens"][0]["token"]
    let filename = token_res.data["tokens"][0]['file_path']
    let upload_url = "https://coco.codemao.cn/http-widget-proxy/" + "https://upload.qiniup.com/"

    // 使用 FormData 自动处理边界参数
    let formData = new FormData();
    formData.append('token', token);
    formData.append('key', filename);
    formData.append('fname', 'test.json');
    formData.append('file', JSON.stringify(file));

    let upload_res = await axios.post(upload_url, formData, { withCredentials: true })
    return upload_res.data["key"]
}

/**
 * 判断是否登录
 */
async function isLogined() {
    try {
        await axios.get("https://api.codemao.cn/tiger/v3/web/accounts/profile", { withCredentials: true })
        return true
    }
    catch {
        return false
    }
}

/**
 * 根据右键的元素获取控件type
 * @param {HTMLElement} node - 右键的元素
 * @returns {string} - 控件类型
 */
function getWidgetType(node) {
    while (node) {
        if (node.attributes && node.attributes['data-widget-type']) {
            return node.attributes['data-widget-type'].value;
        }
        node = node.parentNode;
    }
    return "";
}

/**
 * 等待直到条件满足
 * @param condition 条件
 * @param interval 检测间隔（默认500ms）
 */
async function waitUntil(condition, interval = 500) {
    return new Promise((resolve, reject) => {
        let timer = setInterval(() => {
            if (condition()) {
                clearInterval(timer)
                resolve(null)
            }
        }, interval)
    })
}

/**
 * 当前是否在编辑模式中
 */
function isEditor() {
    return window.location.pathname.startsWith("/editor") && !window.location.pathname.includes("player")
}

/**
 * 当前是否在CoCo编辑器中
 */
function isCoCo() {
    return window.location.hostname == "coco.codemao.cn"
}

/**
 * WidgetRemover 主程序
 * @author 刘lyxAndy
 */
async function main() {
    // ====== 环境检测 ======

    // WidgetRemover 仅在Editor端运行
    if (!isEditor()) {
        return
    }

    // WidgetRemover 仅支持在CoCo编辑器运行
    // 不强制禁用，但弹出警告窗口
    if (!isCoCo()) {
        swal("兼容性警告", "WidgetRemover 仅支持在 coco.codemao.cn 域名下运行，其他域名可能存在兼容性问题。", "warning")
    }

    // WidgetRemover 强制要求登录后使用
    if (!isLogined()) {
        swal("错误", "请在登录后使用 WidgetRemover。", "error")
        return
    }

    // ====== 主程序 ======

    // 监听右键菜单事件
    document.addEventListener('contextmenu', async (e) => {
        // 确定控件类型
        let widget_type = getWidgetType(e.target)

        // WidgetRemover 仅支持自定义控件
        if (!widget_type.startsWith("UNSAFE")) {
            return
        }

        // 右键本体，打开设置窗口
        if (widget_type == "UNSAFE_EXTENSION_WIDGET_REMOVER") {
            let value = await swal("设置", {
                buttons: {
                    delete: "移除 WidgetRemover",
                    about: "关于 WidgetRemover",
                    conf_refresh_before: `开/关移除控件前保存（当前状态：${remover_config.fresh_before_remove}）`,
                },
            })

            switch (value) {

                case "delete":
                    break;

                case "about":
                    swal("关于", "Widget Remover\n版本：V3.0.0\n作者：刘lyxAndy", "info");
                    return;

                case "conf_refresh_before":
                    remover_config.fresh_before_remove = !remover_config.fresh_before_remove
                    saveConfig()
                    swal("设置", `移除控件前保存已${remover_config.fresh_before_remove ? "开启" : "关闭"}`, "success")
                    return;

                default:
                    return;
            }


        }

        // 右键控件，打开移除窗口
        let result = await swal("移除", "是否要删除此自定义控件？" + widget_type, "info", {
            buttons: true
        })
        if (!result) return
        swal("移除中", {
            content: "progress",
            buttons: false
        })

        // 移除前先保存启用
        if (remover_config.fresh_before_remove) {
            // 定位保存按钮与保存完成提示
            let save_button = document.querySelector("#root > div > header > div > div.Header_right__3m7KF > button.coco-button.coco-button-circle.Header_saveBtn__IhQCn")
            let save_dialog = document.querySelector("#root > div > div.coco-alert.coco-alert-info.CommonToast_wrapper__1vp1G")
            if (!save_dialog || !save_button) {
                swal("错误", "编辑器内部错误", "error")
                return
            }
            // 点击保存按钮
            save_button.click()
            // 等待保存完成提示出现
            await waitUntil(() => !save_dialog.classList.contains("hide"))
        }
        // ====== 初始化变量 ======

        // 获取作品workId，以便保存
        let search = new URLSearchParams(location.search)
        let workid = search.get('workId')

        // WidgetRemover 不支持未保存作品
        if (workid == null) {
            swal("错误", "请先保存作品", "error")
            return
        }
        // 获取作品JSON链接
        let work_data = await axios.get(`https://api-creation.codemao.cn/coconut/web/work/${workid}/content`, { withCredentials: true })
        // 防跨域、反域名禁止地获取作品JSON数据
        let url = 'https://coco.codemao.cn/http-widget-proxy/' + (work_data.data.data.bcm_url.includes("creation.codemao.cn") ? work_data.data.data.bcm_url.replace("creation.codemao.cn", "creation.bcmcdn.com") : work_data.data.data.bcm_url)
        let work_json_data = (await axios.get(url, { withCredentials: true })).data
        // 移除控件
        work_json_data.unsafeExtensionWidgetList = work_json_data.unsafeExtensionWidgetList.filter(item => item.type != widget_type)
        // 上传作品文件并获取链接与内容
        let work_pos = await codemao_update_file(work_json_data, Date.now())
        let wdata = (await axios.get("https://creation.codemao.cn/" + work_pos)).data
        // 保存作品
        let data = await axios.put("https://api-creation.codemao.cn/coconut/web/work", {
            archive_version: "0.1.0",
            bcm_url: "https://creation.codemao.cn/" + work_pos,
            id: workid,
            name: wdata["title"],
            preview_url: work_json_data.screens[work_json_data.screenIds[0]].snapshot,
            save_type: 1
        }, { withCredentials: true })
        if (data.status == 200) {
            await swal("成功", "移除成功", "success")
            window.location.reload();
        } else {
            swal("错误", "移除失败", "error")
        }
    })
}

main()
