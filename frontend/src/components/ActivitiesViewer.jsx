import React from "react"

function ActivitiesViewer(rawLLMtext) {

    const match = rawLLMtext.match(/\{[\s\S]*\}/);

    const data = JSON.parse(match)

    return(
        <div style={{border: "1px solid #ccc",borderRadius: "6px", maxHeight: "300px", overflowY: "auto", margin: "12px", padding: "12px"}}>
            {data.activities.map((item, idx) => (
                <div style={{border: "1px solid #ccc", borderRadius: "12px", padding: "16px", marginBottom: "16px", marginTop: "16px", marginLeft: "auto", marginRight: "auto"}}>
                    <h3 style={{margin: "0 0 4px 0"}}>{item.title}</h3>
                    <p style={{margin: "0"}}>{item.description}</p>
                </div>
            ))}
        </div>
    ) 
}

export default ActivitiesViewer;