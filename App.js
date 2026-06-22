import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, SafeAreaView, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';

export default function App() {
  const [courseScale, setCourseScale] = useState('100');
  const [desiredGrade, setDesiredGrade] = useState('90'); // Set back to your target 90 to see the new alert!

  // Dynamic Spreadsheet Grid State
  const [tests, setTests] = useState([
    { id: '1', name: 'A', points: '7.5', maxPoints: '10', weight: '0.10' },
    { id: '2', name: 'B', points: '65.8', maxPoints: '106', weight: '0.30' },
    { id: '3', name: 'C', points: '', maxPoints: '100', weight: '0.30' },
    { id: '4', name: 'D', points: '', maxPoints: '100', weight: '0.30' },
  ]);

  const updateTest = (id, field, value) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addTest = () => {
    const newId = (Math.max(...tests.map(t => parseInt(t.id) || 0)) + 1).toString();
    setTests(prev => [...prev, { id: newId, name: `Test ${newId}`, points: '', maxPoints: '100', weight: '0.10' }]);
  };

  const deleteTest = (id) => {
    setTests(prev => prev.filter(t => t.id !== id));
  };

  // 1. Core Mathematical Metrics Engine
  const analysis = useMemo(() => {
    const scale = parseFloat(courseScale) || 100;
    const target = parseFloat(desiredGrade) || 0;
    
    let currentScorePoints = 0;
    let remainingWeight = 0;
    let totalPossibleRemainingPoints = 0;
    const missing = [];

    tests.forEach(t => {
      const pts = parseFloat(t.points);
      const max = parseFloat(t.maxPoints) || 1;
      const w = parseFloat(t.weight) || 0;

      if (!isNaN(pts)) {
        currentScorePoints += (pts / max) * w * scale;
      } else {
        remainingWeight += w;
        totalPossibleRemainingPoints += w * scale;
        missing.push({ ...t, maxPoints: max, weight: w });
      }
    });

    const maxAchievableGrade = currentScorePoints + totalPossibleRemainingPoints;
    const pointsNeeded = target - currentScorePoints;
    
    // Check if achieving the target is fundamentally impossible
    const isTargetImpossible = target > maxAchievableGrade || pointsNeeded > totalPossibleRemainingPoints;

    return { scale, target, currentScorePoints, remainingWeight, missing, pointsNeeded, maxAchievableGrade, isTargetImpossible };
  }, [tests, courseScale, desiredGrade]);

  // 2. Scenario Matrix Calculator
  const chartData = useMemo(() => {
    const { missing, pointsNeeded, scale, isTargetImpossible } = analysis;
    if (missing.length === 0 || pointsNeeded <= 0 || isTargetImpossible) return null;

    const numExamples = 5;
    const validScenarios = [];

    for (let i = 0; i < numExamples; i++) {
      let targetToDistribute = pointsNeeded;
      let scenarioScores = [];
      let isScenarioValid = true;

      missing.forEach((test, testIdx) => {
        let allocatedPoints = 0;
        const avgRequiredPct = pointsNeeded / (analysis.remainingWeight * scale);

        if (missing.length === 1 || testIdx === missing.length - 1) {
          const requiredPct = targetToDistribute / (test.weight * scale);
          allocatedPoints = requiredPct * test.maxPoints;
        } else {
          const factor = i / (numExamples - 1);
          const dynamicFactor = (testIdx % 2 === 0) ? factor : (1 - factor);
          
          const distToCeiling = 1 - avgRequiredPct;
          const distToFloor = avgRequiredPct;
          const maxSafeSwing = Math.min(distToCeiling, distToFloor, 0.2); 

          let targetPct = avgRequiredPct + (dynamicFactor - 0.5) * (maxSafeSwing * 2);
          targetPct = Math.max(0, Math.min(1, targetPct));

          allocatedPoints = targetPct * test.maxPoints;
          const weightedContribution = (allocatedPoints / test.maxPoints) * test.weight * scale;
          targetToDistribute -= weightedContribution;
        }

        const roundedScore = Math.round(allocatedPoints * 100) / 100;
        if (roundedScore > test.maxPoints || roundedScore < 0) {
          isScenarioValid = false;
        }

        scenarioScores.push(allocatedPoints);
      });

      if (isScenarioValid) {
        validScenarios.push({
          label: missing.length === 1 ? "Required" : `Ex ${i + 1}`,
          scores: scenarioScores
        });
      }
    }

    const uniqueScenarios = validScenarios.filter((scen, index, self) =>
      index === self.findIndex((s) => JSON.stringify(s.scores.map(Math.round)) === JSON.stringify(scen.scores.map(Math.round)))
    );

    if (uniqueScenarios.length === 0) return null;

    const colors = ['#1E90FF', '#FF6347', '#32CD32', '#FFD700', '#9370DB', '#8B4513'];
    const testLines = missing.map((t, idx) => ({
      name: t.name,
      maxPoints: t.maxPoints,
      color: colors[idx % colors.length],
      scores: uniqueScenarios.map(scen => scen.scores[idx])
    }));

    return { examples: uniqueScenarios.map(s => s.label), testLines };
  }, [analysis]);

  // 3. Dynamic Axis Auto-Crop Bounds
  const chartBounds = useMemo(() => {
    if (!chartData) return { min: 0, max: 1 };
    let allValidScores = [];
    chartData.testLines.forEach(line => {
      line.scores.forEach(score => {
        allValidScores.push(score / line.maxPoints);
      });
    });
    if (allValidScores.length === 0) return { min: 0, max: 1 };
    return {
      min: Math.max(0, Math.min(...allValidScores) - 0.1),
      max: Math.min(1, Math.max(...allValidScores) + 0.1)
    };
  }, [chartData]);

  // 4. Responsive Graph Scale Math
  const padding = 50;
  // Dynamic chart width adapts perfectly within our custom maximum container size boundaries
  const windowWidth = Dimensions.get('window').width;
  const maxContainerWidth = 650;
  const actualContainerWidth = windowWidth > maxContainerWidth ? maxContainerWidth : windowWidth;
  const chartWidth = actualContainerWidth - 40;
  const chartHeight = 280;

  const getX = (index, total) => padding + (index / (total - 1 || 1)) * (chartWidth - padding * 2);
  const getY = (score, max) => {
    const pct = score / max;
    const boundRange = chartBounds.max - chartBounds.min;
    const scaledPct = (pct - chartBounds.min) / (boundRange || 1);
    return chartHeight - padding - scaledPct * (chartHeight - padding * 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Maximum Width Shell Container */}
        <View style={styles.contentWrapper}>
          <Text style={styles.title}>Universal Grade Calculator</Text>

          {/* Configuration Grid */}
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Course Scale</Text>
              <TextInput style={styles.input} value={courseScale} onChangeText={setCourseScale} keyboardType="numeric" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Desired Grade</Text>
              <TextInput style={styles.input} value={desiredGrade} onChangeText={setDesiredGrade} keyboardType="numeric" />
            </View>
          </View>

          {/* Current Score Display */}
          <Text style={styles.subtitle}>
            Current Points: {analysis.currentScorePoints.toFixed(2)} / {analysis.scale}
          </Text>

          {/* THE RED IMPOSSIBLE ALERTS */}
          {analysis.isTargetImpossible && (
            <View style={styles.errorAlertBox}>
              <Text style={styles.errorAlertTitle}>⚠️ TARGET UNREACHABLE</Text>
              <Text style={styles.errorAlertText}>
                Your current tests limit your maximum final grade to {analysis.maxAchievableGrade.toFixed(2)} / {analysis.scale}.
              </Text>
            </View>
          )}

          {/* Spreadsheet Table */}
          <View style={styles.table}>
            {/* HEADER ROW - Explicit Percentage Widths */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.headerCell, styles.bold, { width: '35%', textAlign: 'left', paddingLeft: 6 }]}>Test Name</Text>
              <Text style={[styles.headerCell, styles.bold, { width: '18%' }]}>Score</Text>
              <Text style={[styles.headerCell, styles.bold, { width: '18%' }]}>Max Pts</Text>
              <Text style={[styles.headerCell, styles.bold, { width: '18%' }]}>Weight</Text>
              <Text style={[styles.headerCell, styles.bold, { width: '11%' }]}>Delete</Text>
            </View>
            
            {/* DATA ROWS - Identical Percentage Widths */}
            {tests.map(test => (
              <View key={test.id} style={styles.tableRow}>
                <View style={{ width: '35%' }}>
                  <TextInput 
                    style={[styles.inputCell, { textAlign: 'left' }]} 
                    value={test.name} 
                    onChangeText={val => updateTest(test.id, 'name', val)} 
                  />
                </View>
                <View style={{ width: '18%' }}>
                  <TextInput 
                    style={styles.inputCell} 
                    value={test.points} 
                    placeholder="Missing" 
                    onChangeText={val => updateTest(test.id, 'points', val)} 
                    keyboardType="numeric" 
                  />
                </View>
                <View style={{ width: '18%' }}>
                  <TextInput 
                    style={styles.inputCell} 
                    value={test.maxPoints} 
                    onChangeText={val => updateTest(test.id, 'maxPoints', val)} 
                    keyboardType="numeric" 
                  />
                </View>
                <View style={{ width: '18%' }}>
                  <TextInput 
                    style={styles.inputCell} 
                    value={test.weight} 
                    onChangeText={val => updateTest(test.id, 'weight', val)} 
                    keyboardType="numeric" 
                  />
                </View>
                
                {/* Centered Delete Button Container Component */}
                <View style={{ width: '11%', alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTest(test.id)}>
                    <Text style={styles.deleteTxt}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={addTest}>
            <Text style={styles.addBtnTxt}>+ Add Assessment Row</Text>
          </TouchableOpacity>

          {/* Adaptive SVG Chart Output */}
          {chartData && !analysis.isTargetImpossible ? (
            <View style={styles.chartWrapper}>
              <Text style={styles.chartTitle}>Required Points per Scenario</Text>
              
              <View style={styles.legendContainer}>
                {chartData.testLines.map((line, idx) => (
                  <View key={idx} style={styles.legendItem}>
                    <View style={[styles.legendIndicator, { backgroundColor: line.color }]} />
                    <Text style={styles.legendText}>{line.name} (Max {line.maxPoints})</Text>
                  </View>
                ))}
              </View>

              <Svg width={chartWidth} height={chartHeight}>
                <Line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#ccc" strokeWidth="1" />
                <Line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="#ccc" strokeWidth="1" />

                {[0, 0.5, 1].map((step, i) => {
                  const currentPct = chartBounds.min + step * (chartBounds.max - chartBounds.min);
                  const labelY = chartHeight - padding - step * (chartHeight - padding * 2) + 4;
                  return (
                    <React.Fragment key={i}>
                      <SvgText x={padding - 10} y={labelY} textAnchor="end" fontSize="10" fill="#999">
                        {`${Math.round(currentPct * 100)}%`}
                      </SvgText>
                      <Line x1={padding} y1={labelY - 4} x2={chartWidth - padding} y2={labelY - 4} stroke="#f1f3f5" strokeWidth="1" />
                    </React.Fragment>
                  );
                })}

                {chartData.testLines.map((line, lineIdx) => {
                  const pointsString = line.scores
                    .map((score, idx) => `${getX(idx, chartData.examples.length)},${getY(score, line.maxPoints)}`)
                    .join(' ');
                  return (
                    <Polyline key={`l-${lineIdx}`} points={pointsString} fill="none" stroke={line.color} strokeWidth="3" />
                  );
                })}

                {chartData.examples.map((ex, colIdx) => {
                  const columnPoints = chartData.testLines.map((line) => ({
                    name: line.name,
                    color: line.color,
                    score: line.scores[colIdx],
                    maxPoints: line.maxPoints,
                    rawY: getY(line.scores[colIdx], line.maxPoints),
                    scaledPct: line.scores[colIdx] / line.maxPoints
                  }));

                  columnPoints.sort((a, b) => {
                    if (Math.abs(a.rawY - b.rawY) < 1) return b.scaledPct - a.scaledPct;
                    return a.rawY - b.rawY;
                  });

                  let lastY = -999;
                  const minSpacing = 14;
                  const positionedPoints = columnPoints.map((pt) => {
                    let targetY = pt.rawY - 8;
                    if (targetY < lastY + minSpacing) targetY = lastY + minSpacing;
                    lastY = targetY;
                    return { ...pt, adjustedTextY: targetY };
                  });

                  return (
                    <React.Fragment key={`c-${colIdx}`}>
                      {positionedPoints.map((pt, ptIdx) => (
                        <React.Fragment key={`p-${ptIdx}`}>
                          <Circle cx={getX(colIdx, chartData.examples.length)} cy={pt.rawY} r="4" fill={pt.color} />
                          <SvgText x={getX(colIdx, chartData.examples.length)} y={pt.adjustedTextY} fontSize="10" fontWeight="bold" fill="#fff" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" textAnchor="middle">
                            {Math.round(pt.score)}
                          </SvgText>
                          <SvgText x={getX(colIdx, chartData.examples.length)} y={pt.adjustedTextY} fontSize="10" fontWeight="bold" fill={pt.color} textAnchor="middle">
                            {Math.round(pt.score)}
                          </SvgText>
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  );
                })}

                {chartData.examples.map((ex, idx) => (
                  <SvgText key={idx} x={getX(idx, chartData.examples.length)} y={chartHeight - padding + 20} textAnchor="middle" fontSize="11" fill="#666">
                    {ex}
                  </SvgText>
                ))}
              </Svg>
            </View>
          ) : (
            <Text style={styles.infoText}>
              {analysis.isTargetImpossible 
                ? "Cannot chart data. Target score is unreachable." 
                : "Enter weights/max values and leave blank indicators to reveal scenario trends."}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContainer: { padding: 15, alignItems: 'center', width: '100%' },
  // RESTRICT LAYOUT WIDTH: Locks the viewport on desktop so it doesn't get wider than 650px
  contentWrapper: { width: '100%', maxWidth: 650, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#212529' },
  subtitle: { fontSize: 15, marginBottom: 10, color: '#495057', fontWeight: '500' },
  // MATHEMATICALLY IMPOSSIBLE ERROR BOX STYLING
  errorAlertBox: { width: '100%', backgroundColor: '#fdf2f2', borderLeftWidth: 4, borderLeftColor: '#de3545', padding: 12, borderRadius: 6, marginBottom: 15 },
  errorAlertTitle: { color: '#de3545', fontWeight: 'bold', fontSize: 13, marginBottom: 3 },
  errorAlertText: { color: '#7a1c24', fontSize: 13, lineHeight: 17 },
  row: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 10 },
  inputGroup: { flex: 0.48 },
  label: { fontSize: 11, color: '#6c757d', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 6, padding: 8, fontSize: 15 },
  table: { 
    width: '100%', 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#dee2e6', 
    overflow: 'hidden' 
  },
  tableRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderBottomColor: '#dee2e6', 
    paddingVertical: 6, 
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between' // Distributes the percentage blocks evenly
  },
  tableHeader: { 
    backgroundColor: '#f1f3f5',
    paddingVertical: 10
  },
  headerCell: {
    fontSize: 13, 
    color: '#495057',
    textAlign: 'center',
    fontWeight: 'bold'
  },
  inputCell: { 
    backgroundColor: '#f8f9fa', 
    borderRadius: 4, 
    paddingVertical: 5,
    paddingHorizontal: 6, 
    borderWidth: 1, 
    borderColor: '#e9ecef', 
    fontSize: 13,
    color: '#212529',
    textAlign: 'center',
    marginHorizontal: 3 // Gives a small protective safety air gap between input borders
  },
  bold: { 
    fontWeight: 'bold' 
  },
  deleteBtn: { 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 4
  },
  deleteTxt: { 
    color: '#dc3545', 
    fontSize: 15, 
    fontWeight: 'bold' 
  },
  addBtn: { backgroundColor: '#0d6efd', padding: 10, borderRadius: 6, width: '100%', alignItems: 'center', marginVertical: 12 },
  addBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  chartWrapper: { width: '100%', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#dee2e6' },
  chartTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 5 },
  legendIndicator: { width: 12, height: 12, borderRadius: 3, marginRight: 5 },
  legendText: { fontSize: 12, color: '#495057' },
  infoText: { color: '#dc3545', textAlign: 'center', marginTop: 15, fontStyle: 'italic', fontSize: 13, fontWeight: '600', paddingHorizontal: 10 }
});
