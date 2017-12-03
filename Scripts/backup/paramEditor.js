namespace paramEditor
{
	inline function onInitCB()
	{	
		const var PARAMETERS =
		{
			LABELS:["Dynamics", "Expression", "Vibrato", "Vibrato Rate", "Flutter"],
			DYNAMICS:0,
			EXPRESSION:1,
			VIBRATO:2, //Vibrato depth
			VIBRATO_RATE:3,
			BLEND:4 //Flutter/sustain blend
		};
				
		reg realCc = [1, 11, 20, 21, 23]; //Actual CC numbers assigned to modulators (corrospond to parameter enums), -1 means internal/scripted CC, -2 = velocity
		reg userCc = []; //CCs assigned by the user - indexes corrospond to PARAMETERS and realCc[]
		const var controllerNumbers = [];
		
		for (i = 1; i < 128; i++)
		{
			controllerNumbers.push(i);
		}		
		
		//GUI
		const var zone = ui.panel(440, 12, {width:200, height:225, id:"peRightZone", paintRoutine:function(g){g.fillAll(Theme.ZONE);}, parentComponent:tab.getPanelId(tabs[0])}); //Outer panel
		const var lblTitle = ui.label(0, 3, {width:200, height:25, text:"Controllers", textColour:Theme.H1, fontSize:16, fontStyle:"Bold", alignment:"centred", parentComponent:"peRightZone"});

		const var lblParam = ui.label(5, 42, {width:85, height:25, text:"Parameter", textColour:Theme.H2, fontSize:14, fontStyle:"Bold", parentComponent:"peRightZone"});
		const var lblCc = ui.label(5, 77, {width:85, height:25, text:"Controller", textColour:Theme.H2, fontSize:14, fontStyle:"Bold", parentComponent:"peRightZone"});
		const var lblValue = ui.label(5, 112, {width:85, height:25, text:"Value", textColour:Theme.H2, fontSize:14, fontStyle:"Bold", parentComponent:"peRightZone"});

		//Parameter selection dropdown
		const var cmbParam = ui.comboBoxPanel(90, 42, {width:100, height:25, text:"Parameter", items:PARAMETERS.LABELS, paintRoutine:paintRoutines.dropDown, parentComponent:"peRightZone"});

		const var cmbCc = []; //One CC number selection dropdown per parameter
		const var sliValue = []; //One value slider per parameter
		const var tblResponse = []; //One response curve table per parameter
		const var responseBg = ui.panel(10, 147, {width:180, height:70, paintRoutine:function(g){g.fillAll(Theme.CONTROL_FG);}, parentComponent:"peRightZone"}); //Background for tables
		
		for (p in PARAMETERS.LABELS)
		{
			cmbCc.push(ui.comboBoxPanel(90, 77, {width:100, height:25, text:"Controller", visible:false, items:controllerNumbers, paintRoutine:paintRoutines.dropDown, parentComponent:"peRightZone"}));
			sliValue.push(ui.knob(90, 112, {width:100, height:25, style:"Horizontal", min:0, max:127, visible:false, bgColour:Theme.CONTROL_BG, itemColour:Theme.CONTROL_FG, itemColour2:0, textColour:0, parentComponent:"peRightZone"}));
			tblResponse.push(ui.table(10, 147, {width:180, height:70, visible:false, parentComponent:"peRightZone"})); //Add a response curve table for each parameter - hide by default
		}
	}
	
	inline function onControllerCB(ccNum, ccVal)
	{
		if (ccNum != 32 && ccNum != 64 && userCc.contains(ccNum)) //User assigned CC triggered callback - ignore UACC and Sustain pedal
		{
			Message.ignoreEvent(true); //I'll take it from here :-)

			//Redirect incoming user CC to each real CC it's mapped to or to elsewhere for internal CCs	
			for (i = 0; i < PARAMETERS.LABELS.length; i++) //Each parameter
			{
				if (ccNum == cmbCc[i].getValue()) //CC that triggered the callback has been assigned to this index (i)
				{
					parameterResponseHandler(i, ccVal); //Scale the value and pass it to correct CC
					
					//If parameter is currently selected then update UI
					if (cmbParam.getValue()-1 == i) asyncUpdater.setFunctionAndUpdate(updateParameterValueSlider, ccVal);
				}
			}
		}
	}
	
	inline function onControlCB(number, value)
	{		
		if (number == cmbParam)
		{				
			//Hide all parameter controls
			for (i = 0; i < PARAMETERS.LABELS.length; i++)
			{
				cmbCc[i].set("visible", false);
				sliValue[i].set("visible", false);
				tblResponse[i].set("visible", false);
			}
				
			//Show controls for selected parameter
			if (value != 0)
			{
				cmbCc[value-1].set("visible", true);
				sliValue[value-1].set("visible", true);
				tblResponse[value-1].set("visible", true);
				
				cmbCc[value-1].repaint();
			}
		}
		
		for (i = 0; i < PARAMETERS.LABELS.length; i++)
		{
			if (number == cmbCc[i])
			{
				userCc[i] = value; //Store the selected CC
				break;
			}
			else if (number == sliValue[i])
			{
				parameterResponseHandler(cmbParam.getValue()-1, value);
				break;
			}
		}
	}
	
	/*
	 * parameterResponseHandler
	 *
	 * Takes the paramIndex (enum) and current value of the parameter and uses the parameter's response table to 
	 * scale the parameter value and output it as appropriate depending on the type of parameter.
	*/
	inline function parameterResponseHandler(paramIndex, value)
	{
		if (realCc[paramIndex] >= 0) Synth.sendController(realCc[paramIndex], 1 + 126 * tblResponse[paramIndex].getTableValue(value));
	}
		
	inline function updateParameterValueSlider(v)
	{
		sliValue[cmbParam.getValue()-1].setValue(v); //Set value of currently selected parameter's value slider to v
	}
}