// @ts-check
import axios from 'axios';
import swal from 'sweetalert';

let remover_config = JSON.parse(window.localStorage.getItem("remover_config") || '{"fresh_before_remove":true}')

function saveConfig() {
    window.localStorage.setItem("remover_config", JSON.stringify(remover_config))
}

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

async function isLogined() {
    try {
        await axios.get("https://api.codemao.cn/tiger/v3/web/accounts/profile", { withCredentials: true })
        return true
    }
    catch {
        return false
    }
}

function isChildOf(child, parent) {
    if (parent instanceof HTMLCollection || parent instanceof NodeList) {
        for (let i = 0; i < parent.length; i++) {
            if (isChildOf(child, parent[i])) {
                return true
            }
        }
        return false
    }
    while (child != null) {
        if (child == parent) {
            return true
        }
        child = child.parentNode
    }
    return false
}
async function waitUntil(condition, interval = 500) {
    return new Promise((resolve, reject) => {
        let timer = setInterval(() => {
            if (condition()) {
                clearInterval(timer)
                resolve()
            }
        }, interval)
    })
}
async function main() {
    if (!isLogined()) {
        swal("错误", "请先登录", "error")
        return
    }

    let search = new URLSearchParams(location.search)

    let workid = search.get('workId')

    if (workid == null) {
        swal("错误", "请先保存作品", "error")
        return
    }

    let work_data = await axios.get(`https://api-creation.codemao.cn/coconut/web/work/${workid}/content`, { withCredentials: true })

    let url = 'https://coco.codemao.cn/http-widget-proxy/' + (work_data.data.data.bcm_url.includes("creation.codemao.cn") ? work_data.data.data.bcm_url.replace("creation.codemao.cn", "creation.bcmcdn.com") : work_data.data.data.bcm_url)
    let work_json_data = (await axios.get(url, { withCredentials: true })).data

    const WIDGET_SECTION_CLASS = "WidgetList_widgetItem__14O1V"
    document.addEventListener('contextmenu', async (e) => {
        if (!isChildOf(e.target, document.getElementsByClassName(WIDGET_SECTION_CLASS))) {
            return
        }
        let node = e.target
        if (node.attributes['data-widget-type'] == undefined) {
            node = node.parentNode
        }
        let widget_type = node.attributes['data-widget-type'].value
        if (!widget_type.startsWith("UNSAFE")) {
            return
        }
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
        let result = await swal("移除", "是否要删除此自定义控件？" + widget_type, "info", {
            buttons: true
        })
        if (!result) return
        swal("移除中", {
            content: "progress",
            buttons: false
        })
        if (remover_config.fresh_before_remove) {
            let save_button = document.querySelector("#root > div > header > div > div.Header_right__3m7KF > button.coco-button.coco-button-circle.Header_saveBtn__IhQCn")
            let save_dialog = document.querySelector("#root > div > div.coco-alert.coco-alert-info.CommonToast_wrapper__1vp1G")
            if (!save_dialog || !save_button) {
                swal("错误", "编辑器内部错误", "error")
                return
            }
            save_button.click()
            await waitUntil(() => !save_dialog.classList.contains("hide"))
        }
        work_json_data.unsafeExtensionWidgetList = work_json_data.unsafeExtensionWidgetList.filter(item => item.type != widget_type)
        let work_pos = await codemao_update_file(work_json_data, Date.now())
        let wdata = (await axios.get("https://creation.codemao.cn/" + work_pos)).data
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
